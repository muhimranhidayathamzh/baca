-- baca. — skema tabel cache summary (SPEC.md Bagian 2)
--
-- Cara pakai: buka project Supabase kamu > SQL Editor > tempel seluruh isi
-- file ini > Run. Aman dijalankan berulang kali.

CREATE TABLE IF NOT EXISTS summaries (
    paper_id TEXT PRIMARY KEY,        -- OpenAlex work ID bentuk pendek, mis. "W4385245566"
    title TEXT NOT NULL,
    hook TEXT NOT NULL,               -- Pertanyaan hook dalam Bahasa Indonesia
    key_phrase TEXT,                  -- Frasa untuk di-underline
    quick JSONB NOT NULL,             -- Array of 3 strings
    deep TEXT NOT NULL,               -- 2-3 kalimat rangkuman
    original_abstract TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk lookup cepat
CREATE INDEX IF NOT EXISTS idx_summaries_created ON summaries(created_at DESC);

-- Row Level Security: seluruh akses ke tabel ini lewat API route memakai
-- service_role key (yang melewati RLS). Mengaktifkan RLS tanpa policy apa pun
-- memastikan anon/authenticated key TIDAK bisa membaca atau menulis tabel ini
-- seandainya nanti dipakai dari browser.
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
