// Shared types reflecting the `pet_podcast` schema.

export type EpisodeStatus = 'draft' | 'processing' | 'published' | 'archived';
export type AnimalType = 'canine' | 'feline' | 'exotic' | 'avian' | 'equine' | 'other';

export interface Vet {
  id: string;
  name: string;
  slug: string;
  specialty: string | null;
  clinic_name: string | null;
  clinic_location: string | null;
  bio: string | null;
  bio_photo_url: string | null;
  website_url: string | null;
}

export interface Episode {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  season: number | null;
  episode_number: number | null;
  guest_vet_id: string | null;
  audio_url: string | null;
  image_url: string | null;
  spotify_url: string | null;
  duration_seconds: number | null;
  animal_types: AnimalType[];
  status: EpisodeStatus;
  published_at: string | null;
  created_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export type EntityLinkType =
  | 'condition'
  | 'medication'
  | 'breed'
  | 'procedure'
  | 'organization'
  | 'product'
  | 'nutrient'
  | 'other';

export interface EntityLink {
  term: string;
  type: EntityLinkType;
  url: string;
  description?: string;
}

export interface Transcript {
  episode_id: string;
  raw_text: string | null;
  segments: TranscriptSegment[];
  language: string | null;
  entity_links: EntityLink[];
}

export interface ShowNotes {
  episode_id: string;
  summary: string | null;
  key_takeaways: string[];
  chapters: { start: number; title: string }[];
  seo_description: string | null;
}
