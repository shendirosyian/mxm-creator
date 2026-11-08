export interface SamplePlayer {
  id: string;
  name: string;
  description: string;
  url: string;
  bodyVisibility: string;
}

export interface SampleGarment {
  id: string;
  name: string;
  slot: 'top' | 'pants' | 'shoes' | 'accessories';
  description: string;
  url: string;
  colorHex: string;
}

export const SAMPLE_PLAYERS: SamplePlayer[] = [
  {
    id: 'alex',
    name: 'Alex Rivera',
    description: 'Casual daylight portrait / Natural upper body',
    url: '/src/assets/images/sample_player_alex_1794135331037.jpg',
    bodyVisibility: 'Half Body / Upper Torso',
  },
  {
    id: 'elena',
    name: 'Elena Vance',
    description: 'Clean studio model portrait / Minimal tank top',
    url: '/src/assets/images/sample_player_elena_1794135331558.jpg',
    bodyVisibility: 'Half Body',
  },
];

export const SAMPLE_GARMENTS: SampleGarment[] = [
  {
    id: 'bomber',
    name: 'Olive Minimalist Bomber',
    slot: 'top',
    description: 'Matte nylon fabric with ribbed collar & silver zipper',
    url: '/src/assets/images/sample_garment_jacket_1794135332415.jpg',
    colorHex: '#525B44',
  },
  {
    id: 'graphic_tee',
    name: 'Urban Echoes Heavy Tee',
    slot: 'top',
    description: 'Heavyweight black cotton with bold typography print',
    url: '/src/assets/images/sample_garment_streetwear_1794135332073.jpg',
    colorHex: '#121212',
  },
];

export const PRESET_SWATCHES = [
  { name: 'Onyx Black', hex: '#111315' },
  { name: 'Studio Chalk', hex: '#F3F4F6' },
  { name: 'Deep Navy', hex: '#1E293B' },
  { name: 'Olive Drab', hex: '#4A533E' },
  { name: 'Warm Terracotta', hex: '#8B4513' },
  { name: 'Burgundy', hex: '#581825' },
  { name: 'Steel Slate', hex: '#64748B' },
  { name: 'Sand Beige', hex: '#C2B280' },
];

export const EXPRESSION_PRESETS = [
  'Original',
  'Confident',
  'Neutral',
  'Smiling',
  'Serious',
  'Happy',
  'Angry',
  'Surprised',
  'Custom',
];

export const HAIRSTYLE_PRESETS = [
  'Original',
  'Short Textured',
  'Buzz Cut',
  'Fade',
  'Long Layered',
  'Curly Volume',
  'Undercut',
  'Straight Sleek',
  'Wavy Flow',
  'Custom',
];

export const HAIR_COLOR_PRESETS = [
  'Original',
  'Natural Black',
  'Dark Espresso',
  'Warm Chestnut',
  'Platinum Blonde',
  'Honey Blonde',
  'Silver Grey',
  'Auburn Red',
];

export const POSE_PRESETS = [
  'Original',
  'Standing Confident',
  'Walking Natural',
  'Hands in Pockets',
  'Editorial Crossed Arms',
  'Dynamic 3/4 Turn',
  'Custom',
];

export const LIGHTING_PRESETS = [
  'Original',
  'Studio Soft Light',
  'Natural Daylight',
  'Dramatic Chiaroscuro',
  'Editorial Rim Light',
  'Warm Golden Hour',
];
