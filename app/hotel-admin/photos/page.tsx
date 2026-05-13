'use client';

/* ═══════════════════════════════════════════════════════════════════════
   HOTEL-ADMIN → PHOTO MANAGEMENT
   ----------------------------------------------------------------------
   Web mirror of mobile photo upload feature. Endpoints:
     GET    /p/api/hotels/my                 (get owned hotel)
     GET    /p/api/photos/hotel/:hotelId     (list photos)
     POST   /p/api/photos/upload             (multipart, field 'photo')
     DELETE /p/api/photos/delete/:id

   Notes:
     • Max 5MB per image (server-enforced)
     • Allowed: jpg / jpeg / png / webp
     • Photos serve from S3 if configured (req.file.location), else local
   ═══════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getAuth, API_ROOT, API_TOKEN } from '@/lib/api';
import { Spinner, EmptyState } from '@/components/shared/ui';

type Photo = { _id: string; photo: string; hotel_id: string };
type Hotel = { _id: string; name: string };

const MAX_BYTES   = 5 * 1024 * 1024;
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];

export default function HotelPhotosPage() {
  const auth = getAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const jsonHeaders = {
    'Content-Type': 'application/json',
    'x-api-token': API_TOKEN,
    Authorization: `Bearer ${auth?.token}`,
  };

  // multipart: no Content-Type — browser sets boundary
  const multipartHeaders = {
    'x-api-token': API_TOKEN,
    Authorization: `Bearer ${auth?.token}`,
  };

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const hRes = await fetch(`${API_ROOT}/api/hotels/my`, { headers: jsonHeaders });
      if (!hRes.ok) {
        setHotel(null); setPhotos([]); return;
      }
      const data = await hRes.json();
      const h: Hotel | null = data?.hotel || null;
      setHotel(h);
      if (h?._id) {
        const pRes = await fetch(`${API_ROOT}/api/photos/hotel/${h._id}`, { headers: jsonHeaders });
        const list = pRes.ok ? await pRes.json() : [];
        setPhotos(Array.isArray(list) ? list : []);
      } else {
        setPhotos([]);
      }
    } catch (e: any) {
      setError(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  function validateFile(file: File): string | null {
    if (file.size > MAX_BYTES) return 'File 5MB se zyada hai';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXT.includes(ext)) return 'Sirf JPG / PNG / WEBP allowed hain';
    return null;
  }

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    const files = e.target.files;
    if (!files || files.length === 0 || !hotel) return;

    // Upload each file sequentially to keep error messages clear
    setUploading(true);
    let failures = 0;
    for (const file of Array.from(files)) {
      const err = validateFile(file);
      if (err) { setError(`${file.name}: ${err}`); failures++; continue; }

      try {
        const fd = new FormData();
        fd.append('hotel_id', hotel._id);
        fd.append('photo', file);

        const res = await fetch(`${API_ROOT}/api/photos/upload`, {
          method: 'POST',
          headers: multipartHeaders,
          body: fd,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d?.error || `${file.name} upload fail`);
          failures++;
        }
      } catch (e: any) {
        setError(e?.message || 'Upload error');
        failures++;
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await load();
    if (failures === 0) setError('');
  }

  async function deletePhoto(id: string) {
    if (!confirm('Yeh photo delete karni hai?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_ROOT}/api/photos/delete/${id}`, {
        method: 'DELETE',
        headers: jsonHeaders,
      });
      if (res.ok) {
        setPhotos(prev => prev.filter(p => p._id !== id));
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || 'Delete fail');
      }
    } catch (e: any) {
      setError(e?.message || 'Delete error');
    } finally {
      setDeletingId('');
    }
  }

  function fullUrl(photo: string): string {
    if (!photo) return '';
    if (photo.startsWith('http')) return photo;
    // local path stored as /uploads/hotel-photos/... — prefix with API base
    return `${API_ROOT.replace('/p', '')}${photo}`;
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!hotel) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🏨</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Pehle Hotel Setup Karo</h2>
        <p className="text-gray-500 mb-6">Photos add karne ke liye hotel profile chahiye</p>
        <Link href="/hotel-admin/property" className="btn-primary px-8">Setup Property</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
        <div>
          <Link href="/hotel-admin/property" className="text-sm text-gray-500 hover:text-gray-800">
            ← Back to Property
          </Link>
          <h1 className="text-2xl font-black text-gray-900 mt-1">📸 Hotel Photos</h1>
          <p className="text-sm text-gray-500">{hotel.name} · {photos.length} photo{photos.length === 1 ? '' : 's'}</p>
        </div>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={onFilePick}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? <Spinner size="sm" /> : <span>📤</span>}
            {uploading ? 'Uploading...' : 'Upload Photos'}
          </button>
        </div>
      </div>

      {/* Guidance card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 mb-6">
        <p className="font-bold mb-1">💡 Best Practices</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-800">
          <li>Min 5–10 photos add karo — booking 3x zyada hote hain</li>
          <li>Reception, rooms (har type), bathroom, lobby — sab cover karo</li>
          <li>Daylight mein clear, high-quality photos lo</li>
          <li>Max 5 MB per photo · JPG / PNG / WEBP</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4">
          ⚠️ {error}
        </div>
      )}

      {photos.length === 0 ? (
        <EmptyState
          icon="📷"
          title="Abhi tak koi photo nahi"
          desc="Pehli photo upload karke shuru karo"
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map(p => (
            <div key={p._id} className="relative group bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setPreviewUrl(fullUrl(p.photo))}
                className="block w-full aspect-square overflow-hidden bg-gray-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fullUrl(p.photo)}
                  alt="Hotel"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              </button>
              <button
                onClick={() => deletePhoto(p._id)}
                disabled={deletingId === p._id}
                className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
              >
                {deletingId === p._id ? '...' : '🗑️'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreviewUrl('')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewUrl('')}
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white text-2xl rounded-full"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
