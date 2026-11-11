import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type {
  ApprovedRunVideo,
  RejectedRunVideo,
  RunVideoAnalysis,
} from '@/lib/run-video-analysis.server';
import { bestRunTime, isSlowerIsBetterGame } from '@/lib/game-rules';

const HEURISTIC_VERSION = 'splitrush-va-heuristic-v2';

interface RunRow {
  id: string;
  game_id: string;
  category_id: string;
  runner_id: string;
  time_ms: number;
  platform: string;
  video_url: string;
  video_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface RefRow {
  id: string;
  run_id: string;
  label: string;
  notes: string | null;
  run: {
    id: string;
    time_ms: number;
    video_url: string;
    video_id: string | null;
    platform: string;
    status: string;
    rejection_reason: string | null;
  } | null;
}

interface CategoryRow {
  id: string;
  name: string;
  timing_rules: string | null;
}

interface GameRow {
  id: string;
  title: string;
  slug: string;
}

interface OEmbedData {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  type?: string;
}


export const runVerification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((input: { runId: string }) => {
    if (!input || typeof input.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.runId)) throw new Error('runId required');
    return input;
  })
  .handler(async ({ data, context }) => {
    const runId = data.runId;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const admin = supabaseAdmin as unknown as SupabaseClient;
    // Fetch the run
    const { data: run, error: runErr } = await admin
      .from('runs')
      .select(
        'id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, notes, created_at'
      )
      .eq('id', runId)
      .maybeSingle<RunRow>();

    if (runErr || !run) {
      throw new Error('Run not found');
    }

    const { data: isOwner, error: roleError } = await admin.rpc('has_role', {
      _user_id: context.userId,
      _role: 'owner',
    });
    if (roleError) throw new Error('Could not authorize video analysis');
    if (!isOwner) throw new Error('Only an owner can analyze runs');

    // Fetch game + category for context
    const { data: game } = await admin
      .from('games')
      .select('id, title, slug')
      .eq('id', run.game_id)
      .maybeSingle<GameRow>();

    const { data: category } = await admin
      .from('categories')
      .select('id, name, timing_rules')
      .eq('id', run.category_id)
      .maybeSingle<CategoryRow>();

    // Fetch reference examples for this game + category
    const { data: refs } = await admin
      .from('reference_examples')
      .select(
        'id, run_id, label, notes, run:runs(id, time_ms, video_url, video_id, platform, status, rejection_reason)'
      )
      .eq('game_id', run.game_id)
      .eq('category_id', run.category_id)
      .order('created_at', { ascending: false });

    const refList = (refs as unknown as RefRow[]) ?? [];

    const { data: approvedRunRows, error: approvedRunsError } = await admin
      .from('runs')
      .select('id, time_ms, video_id, platform')
      .eq('game_id', run.game_id)
      .eq('category_id', run.category_id)
      .eq('status', 'verified')
      .neq('id', run.id)
      .not('video_id', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(2);
    if (approvedRunsError) {
      console.error('Could not load approved run examples for video analysis', approvedRunsError);
    }
    const candidateApprovedRuns = (approvedRunRows as ApprovedRunVideo[] | null) ?? [];
    const approvedRunResults = await Promise.all(
      candidateApprovedRuns.map(async (approvedRun) => {
        if (!approvedRun.video_id) return null;
        try {
          const response = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${approvedRun.video_id}&format=json`,
            { signal: AbortSignal.timeout(6000) },
          );
          return response.ok ? approvedRun : null;
        } catch (error) {
          console.warn('Could not confirm approved reference video is public', error);
          return null;
        }
      }),
    );
    const approvedRuns = approvedRunResults.filter(
      (approvedRun): approvedRun is ApprovedRunVideo => approvedRun !== null,
    );
    const candidateRejectedRuns = refList
      .flatMap((ref): RejectedRunVideo[] => {
        if (ref.label !== 'rejected' || !ref.run || ref.run.id === run.id) return [];
        return [{
          id: ref.run.id,
          time_ms: ref.run.time_ms,
          video_id: ref.run.video_id,
          platform: ref.run.platform,
          reason: ref.notes ?? ref.run.rejection_reason,
        }];
      })
      .filter((rejectedRun) => /^[A-Za-z0-9_-]{11}$/.test(rejectedRun.video_id ?? ''))
      .slice(0, 2);
    const rejectedRunResults = await Promise.all(
      candidateRejectedRuns.map(async (rejectedRun) => {
        if (!rejectedRun.video_id) return null;
        try {
          const response = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${rejectedRun.video_id}&format=json`,
            { signal: AbortSignal.timeout(6000) },
          );
          return response.ok ? rejectedRun : null;
        } catch (error) {
          console.warn('Could not confirm rejected reference video is public', error);
          return null;
        }
      }),
    );
    const rejectedRuns = rejectedRunResults.filter(
      (rejectedRun): rejectedRun is RejectedRunVideo => rejectedRun !== null,
    );

    // Fetch YouTube oEmbed metadata (publicly accessible, no API key needed)
    let oembed: OEmbedData | null = null;
    let videoAccessible = false;
    let oembedError: string | null = null;

    if (run.video_id) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${run.video_id}&format=json`;
        const resp = await fetch(oembedUrl, {
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          oembed = (await resp.json()) as OEmbedData;
          videoAccessible = true;
        } else if (resp.status === 401 || resp.status === 404) {
          oembedError = `Video not publicly accessible (HTTP ${resp.status})`;
        } else {
          oembedError = `oEmbed returned HTTP ${resp.status}`;
        }
      } catch (e) {
        oembedError = e instanceof Error ? e.message : 'oEmbed fetch failed';
      }
    }

    // ---- Metadata and statistical assessment ----
    const verifiedRefs = refList.filter((r) => r.label === 'verified');
    const rejectedRefs = refList.filter((r) => r.label === 'rejected');
    const verifiedTimes = verifiedRefs
      .map((r) => r.run?.time_ms)
      .filter((t): t is number => typeof t === 'number' && t > 0);

    const observed: string[] = [];
    const speculation: string[] = [];
    const concerns: string[] = [];
    let evidenceBasis: 'video_analysis' | 'metadata' | 'statistical' | 'incomplete' =
      'incomplete';
    let confidence = 0.3;

    if (videoAccessible && oembed) {
      evidenceBasis = 'metadata';
      observed.push(
        `YouTube video is accessible. Title: "${oembed.title ?? 'unknown'}". Channel: "${oembed.author_name ?? 'unknown'}".`
      );
    } else {
      evidenceBasis = 'incomplete';
      observed.push(
        oembedError
          ? `YouTube video could not be accessed: ${oembedError}`
          : 'No video ID was parsed from the submitted URL.'
      );
      concerns.push('Video could not be accessed — cannot confirm it shows the run.');
    }

    let frameAnalysis: RunVideoAnalysis | null = null;
    let frameAnalysisUnavailable: string | null = null;
    const geminiApiKey = process.env['GEMINI_API_KEY'];
    if (!geminiApiKey) {
      frameAnalysisUnavailable = 'GEMINI_API_KEY is not configured.';
    } else if (!videoAccessible) {
      frameAnalysisUnavailable = 'The submitted YouTube video is not publicly accessible.';
    } else if (!run.video_id || !category) {
      frameAnalysisUnavailable = 'The submitted video or category could not be identified.';
    } else {
      try {
        const { analyzeRunVideos } = await import('@/lib/run-video-analysis.server');
        frameAnalysis = await analyzeRunVideos({
          apiKey: geminiApiKey,
          gameTitle: game?.title ?? 'Unknown game',
          categoryName: category.name,
          timingRules: category.timing_rules,
          submittedRun: {
            id: run.id,
            time_ms: run.time_ms,
            video_id: run.video_id,
            platform: run.platform,
          },
          approvedRuns,
          rejectedRuns,
        });
      } catch (error) {
        console.error('Gemini video frame analysis failed', error);
        frameAnalysisUnavailable = 'Gemini could not complete video frame analysis.';
      }
    }

    // Statistical comparison with verified reference examples
    if (verifiedTimes.length > 0) {
      evidenceBasis = evidenceBasis === 'incomplete' ? 'statistical' : 'statistical';
      const slowerIsBetter = game ? isSlowerIsBetterGame(game, true) : false;
      const bestRef = bestRunTime(verifiedTimes, slowerIsBetter)!;
      const meanRef =
        verifiedTimes.reduce((a, b) => a + b, 0) / verifiedTimes.length;
      const ratio = slowerIsBetter ? bestRef / run.time_ms : run.time_ms / bestRef;

      observed.push(
        `${verifiedTimes.length} verified reference example(s) for this game/category. Best reference time: ${fmtTime(bestRef)}. Mean: ${fmtTime(meanRef)}. Submitted time: ${fmtTime(run.time_ms)}.`
      );

      if (ratio < 0.5) {
        concerns.push(
          `Submitted time is ${Math.round((1 - ratio) * 100)}% better than the best verified reference. This is a large deviation that warrants investigation.`
        );
        confidence = 0.45;
      } else if (ratio < 0.85) {
        concerns.push(
          `Submitted time is notably better than the best verified reference (ratio ${ratio.toFixed(2)}).`
        );
        confidence = 0.55;
      } else if (ratio > 2.0) {
        observed.push(
          `Submitted time is slower than references, which is not inherently suspicious.`
        );
        confidence = 0.5;
      } else {
        observed.push(
          `Submitted time is within a plausible range relative to verified examples.`
        );
        confidence = 0.65;
      }
    } else {
      speculation.push(
        'No verified reference examples exist for this game/category yet. The AI cannot perform a statistical comparison. Owner judgment is especially important here.'
      );
      confidence = 0.25;
    }

    if (frameAnalysis) {
      evidenceBasis = 'video_analysis';
      confidence = frameAnalysis.confidence;
      observed.push(frameAnalysis.summary, ...frameAnalysis.observations);
      concerns.push(...frameAnalysis.concerns);
      speculation.push(...frameAnalysis.speculation);
      if (frameAnalysis.approvedRunIds.length === 0) {
        speculation.push(
          'No approved video references were available. The frame review assessed this run without positive video examples.',
        );
      }
    } else {
      speculation.push(
        frameAnalysisUnavailable
          ? `Video frames were not analyzed: ${frameAnalysisUnavailable}`
          : 'Video frames were not analyzed.',
      );
    }

    // Check if video title appears to relate to the game
    if (oembed?.title && game) {
      const titleLower = oembed.title.toLowerCase();
      const gameTitleLower = game.title.toLowerCase();
      const gameKeywords = gameTitleLower
        .split(/[\s:,-]+/)
        .filter((w) => w.length > 2);
      const matchesGame = gameKeywords.some((kw) => titleLower.includes(kw));
      if (matchesGame) {
        observed.push('Video title appears to reference the selected game.');
      } else {
        concerns.push(
          'Video title does not appear to reference the selected game. This may be the wrong video.'
        );
      }
    }

    // Platform consistency check
    const refPlatforms = new Set(
      verifiedRefs
        .map((r) => r.run?.platform)
        .filter((p): p is string => typeof p === 'string')
    );
    if (refPlatforms.size > 0 && run.platform && !refPlatforms.has(run.platform)) {
      speculation.push(
        `Submitted platform "${run.platform}" differs from reference platforms (${[...refPlatforms].join(', ')}). This may be legitimate but worth noting.`
      );
    }

    // Rejected example pattern match
    if (rejectedRefs.length > 0) {
      const rejectedTimes = rejectedRefs
        .map((r) => r.run?.time_ms)
        .filter((t): t is number => typeof t === 'number');
      if (rejectedTimes.length > 0) {
        const closeToRejected = rejectedTimes.some(
          (t) => Math.abs(t - run.time_ms) / t < 0.05
        );
        if (closeToRejected) {
          concerns.push(
            'Submitted time is very close to a previously rejected reference example.'
          );
        }
      }
    }

    // ---- Determine recommendation ----
    let recommendation:
      | 'likely_consistent'
      | 'needs_review'
      | 'potential_concern';

    if (concerns.length > 0) {
      recommendation = 'potential_concern';
    } else if (frameAnalysis?.recommendation === 'likely_consistent') {
      recommendation = 'likely_consistent';
    } else if (frameAnalysis?.recommendation === 'potential_concern') {
      recommendation = 'potential_concern';
    } else {
      recommendation = 'needs_review';
    }

    // If video is inaccessible, never say likely_consistent
    if (!videoAccessible) {
      recommendation = 'needs_review';
    }

    const explanation = buildExplanation(
      recommendation,
      observed,
      concerns,
      speculation,
      frameAnalysis,
      frameAnalysisUnavailable,
      videoAccessible,
    );

    const inputEvidence = {
      run_id: run.id,
      game_title: game?.title,
      category_name: category?.name,
      submitted_time_ms: run.time_ms,
      platform: run.platform,
      video_url: run.video_url,
      video_id: run.video_id,
      video_accessible: videoAccessible,
      video_frames_analyzed: frameAnalysis !== null,
      analyzed_video_count: frameAnalysis?.analyzedVideoIds.length ?? 0,
      approved_run_ids_analyzed: frameAnalysis?.approvedRunIds ?? [],
      rejected_run_ids_analyzed: frameAnalysis?.rejectedRunIds ?? [],
      frame_analysis_model: frameAnalysis?.modelVersion ?? null,
      frame_analysis_unavailable_reason: frameAnalysisUnavailable,
      oembed_title: oembed?.title ?? null,
      oembed_author: oembed?.author_name ?? null,
      timing_rules: category?.timing_rules ?? null,
      verified_ref_count: verifiedRefs.length,
      rejected_ref_count: rejectedRefs.length,
      best_verified_time_ms:
        verifiedTimes.length > 0
          ? bestRunTime(
              verifiedTimes,
              game ? isSlowerIsBetterGame(game, true) : false,
            )
          : null,
    };

    const refIds = refList.map((r) => r.id);

    // Record assessment via the privileged RPC (service role bypasses RLS,
    // and record_assessment rejects calls with a non-null auth.uid()).
    const { error: rpcErr } = await admin.rpc('record_assessment', {
      p_run_id: run.id,
      p_recommendation: recommendation,
      p_confidence: confidence,
      p_explanation: explanation,
      p_evidence_basis: evidenceBasis,
      p_observed_evidence: observed.join('\n'),
      p_speculation: speculation.join('\n'),
      p_model_version: frameAnalysis?.modelVersion ?? HEURISTIC_VERSION,
      p_input_evidence: inputEvidence,
      p_reference_example_ids: refIds,
    });


    if (rpcErr) {
      console.error('record_assessment failed', rpcErr);
      throw new Error('Could not record assessment');
    }
    return {
      run_id: run.id,
      recommendation,
      confidence,
      evidence_basis: evidenceBasis,
      video_accessible: videoAccessible,
      video_frames_analyzed: frameAnalysis !== null,
      approved_runs_analyzed: frameAnalysis?.approvedRunIds.length ?? 0,
      rejected_runs_analyzed: frameAnalysis?.rejectedRunIds.length ?? 0,
      reference_examples_used: refIds.length,
    };
  });

function buildExplanation(
  rec: string,
  observed: string[],
  concerns: string[],
  speculation: string[],
  frameAnalysis: RunVideoAnalysis | null,
  frameAnalysisUnavailable: string | null,
  videoAccessible: boolean,
): string {
  const parts: string[] = [];
  const recLabel = {
    likely_consistent: 'Likely consistent',
    needs_review: 'Needs review',
    potential_concern: 'Potential concern',
  }[rec] ?? rec;

  parts.push(`Recommendation: ${recLabel}.`);
  parts.push('');
  parts.push('OBSERVED EVIDENCE:');
  parts.push(
    observed.length > 0
      ? observed.map((s) => `  - ${s}`).join('\n')
      : '  - No direct evidence available.'
  );

  if (concerns.length > 0) {
    parts.push('');
    parts.push('POTENTIAL CONCERNS:');
    parts.push(concerns.map((s) => `  - ${s}`).join('\n'));
  }

  if (speculation.length > 0) {
    parts.push('');
    parts.push('SPECULATION (not verified evidence):');
    parts.push(speculation.map((s) => `  - ${s}`).join('\n'));
  }

  parts.push('');
  parts.push(
    frameAnalysis
      ? `NOTE: Gemini sampled frames from the submitted run, ${frameAnalysis.approvedRunIds.length} approved example(s), and ${frameAnalysis.rejectedRunIds.length} rejected example(s). Sampling may miss events; owners must watch the proof and make the final decision.`
      : videoAccessible
        ? `NOTE: Video frames were not analyzed${frameAnalysisUnavailable ? ` (${frameAnalysisUnavailable})` : ''}. Metadata/statistics cannot establish that the run is valid; manual review is required.`
        : 'NOTE: Video could not be accessed. This assessment is based on incomplete evidence. The run requires manual review and possibly additional proof.'
  );
  parts.push('This is an AI recommendation, not an official verification status.');

  return parts.join('\n');
}

function fmtTime(ms: number): string {
  const total = Math.floor(ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const milli = total % 1000;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const mmm = String(milli).padStart(3, '0');
  return h > 0 ? `${h}:${mm}:${ss}.${mmm}` : `${mm}:${ss}.${mmm}`;
}
