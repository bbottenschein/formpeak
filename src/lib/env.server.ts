import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} fehlt. Siehe .env.example.`);
  }
  return value;
}

/** Secret Key von Supabase: umgeht RLS, nur für Jobs und Skripte. */
export const supabaseSecretKey = () => required("SUPABASE_SECRET_KEY");

/** Schützt die Routen unter /api/jobs/*. */
export const jobsSecret = () => required("JOBS_SECRET");
