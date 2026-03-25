
-- Create storage bucket for tour program PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-programs', 'tour-programs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to tour-programs bucket
CREATE POLICY "Authenticated users can upload tour programs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tour-programs');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update tour programs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tour-programs');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete tour programs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tour-programs');

-- Allow public read access to tour programs
CREATE POLICY "Public can view tour programs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tour-programs');
