import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AdminUpdate, AdminUpdateType } from "@/lib/types";
import { timeAgo } from "@/lib/format";

const updateTypes: { value: AdminUpdateType; label: string }[] = [
  { value: "feature", label: "New feature" },
  { value: "improvement", label: "Improvement" },
  { value: "fix", label: "Fix" },
  { value: "other", label: "Other" },
];

const typeLabels: Record<AdminUpdateType, string> = {
  feature: "New feature",
  improvement: "Improvement",
  fix: "Fix",
  other: "Other",
};

const updateColumns = "id, title, update_type, description, created_by, created_at";

export function AdminUpdatesPanel({ actorId }: { actorId: string }) {
  const [updates, setUpdates] = useState<AdminUpdate[]>([]);
  const [title, setTitle] = useState("");
  const [updateType, setUpdateType] = useState<AdminUpdateType>("feature");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("admin_updates")
      .select(updateColumns)
      .order("created_at", { ascending: false })
      .limit(20);
    if (loadError) {
      console.error("admin updates failed to load", loadError);
      setError("Updates could not be loaded. Apply the admin updates migration, then retry.");
    } else {
      setUpdates((data as AdminUpdate[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUpdates();
  }, [loadUpdates]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setError("Enter both a title and a description.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data, error: insertError } = await supabase
        .from("admin_updates")
        .insert({
          title: trimmedTitle,
          update_type: updateType,
          description: trimmedDescription,
          created_by: actorId,
        })
        .select(updateColumns)
        .single();
      if (insertError) throw insertError;
      setUpdates((current) => [data as AdminUpdate, ...current].slice(0, 20));
      setTitle("");
      setDescription("");
      setUpdateType("feature");
      setNotice("Update saved.");
    } catch (cause) {
      console.error("admin update failed to save", cause);
      setError("Update could not be saved. Check the database migration and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(update: AdminUpdate) {
    if (!confirm(`Delete the update "${update.title}"?`)) return;
    setDeletingId(update.id);
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await supabase
        .from("admin_updates")
        .delete()
        .eq("id", update.id);
      if (deleteError) throw deleteError;
      setUpdates((current) => current.filter((entry) => entry.id !== update.id));
      setNotice("Update deleted.");
    } catch (cause) {
      console.error("admin update failed to delete", cause);
      setError("Update could not be deleted. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="sr-card mb-8 p-5" aria-labelledby="admin-updates-title">
      <div className="mb-4 flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-[var(--sr-primary)]" />
        <div>
          <h2 id="admin-updates-title" className="font-semibold text-emerald-50">
            Admin update log
          </h2>
          <p className="text-xs text-emerald-700">Private notes for owners about what changed.</p>
        </div>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-emerald-100">
          Update type
          <select
            value={updateType}
            onChange={(event) => setUpdateType(event.target.value as AdminUpdateType)}
            className="sr-input mt-1"
          >
            {updateTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-emerald-100">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            className="sr-input mt-1"
            placeholder="e.g. Added member management"
          />
        </label>
        <label className="text-sm text-emerald-100 md:col-span-2">
          What changed?
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            required
            rows={3}
            className="sr-input mt-1 resize-y"
            placeholder="Describe what was updated and any useful details."
          />
        </label>
        <div className="flex items-center gap-3 md:col-span-2">
          <button type="submit" disabled={saving} className="sr-btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save update
          </button>
          <span aria-live="polite" className="text-sm text-emerald-300">
            {notice}
          </span>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-red-400 px-3 py-2 text-sm text-red-300">
          {error}
          <button type="button" className="sr-link ml-2" onClick={() => void loadUpdates()}>
            Retry
          </button>
        </p>
      )}

      <div className="mt-5 border-t border-[var(--sr-border)] pt-4">
        <h3 className="mb-2 text-sm font-semibold text-emerald-100">Recent updates</h3>
        {loading ? (
          <Loader2
            className="h-5 w-5 animate-spin text-[var(--sr-primary)]"
            aria-label="Loading updates"
          />
        ) : updates.length === 0 ? (
          <p className="text-sm text-emerald-700">No updates recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--sr-border)]">
            {updates.map((update) => (
              <li key={update.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="sr-badge bg-[var(--sr-surface-2)] text-[var(--sr-primary)]">
                      {typeLabels[update.update_type]}
                    </span>
                    <h4 className="font-medium text-emerald-50">{update.title}</h4>
                    <time className="text-xs text-emerald-700" dateTime={update.created_at}>
                      {timeAgo(update.created_at)}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-100/80">
                    {update.description}
                  </p>
                </div>
                <button
                  type="button"
                  className="sr-btn-ghost shrink-0"
                  aria-label={`Delete update: ${update.title}`}
                  disabled={deletingId !== null}
                  onClick={() => void handleDelete(update)}
                >
                  {deletingId === update.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
