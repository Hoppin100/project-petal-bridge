# Project Petal Bridge

/skill:migrate-external-project Source: Bolt. Migrate the attached project into Lovable.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7fd58f2e-9dd2-40a3-bd29-f74aafa6c6e2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Before deploying, apply database migrations `0003_add_moderator_role` and
`0004_hide_games` to enable moderator access and game visibility controls.
Apply `drizzle/migrations/0006_allow_duplicate_subcategories.sql` to the project
database to allow same-named subcategories under different main categories.
Pushing the code does not apply this SQL migration automatically.

To enable visual run assessments, add `GEMINI_API_KEY` as a server-side secret
in Lovable Cloud. Owners can request an assessment from the verification
dashboard. Gemini analyzes the submitted public YouTube video alongside up to
two public, owner-approved runs for the same game and category. These examples
are provided as context for each assessment; this does not train or fine-tune a
model. If the key is missing or videos are not public, the app records a
non-visual assessment and requires owner review.
