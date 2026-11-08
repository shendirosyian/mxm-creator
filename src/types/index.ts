export type GarmentSlotId = 'top' | 'pants' | 'shoes' | 'accessories';

export interface PlayerAnalysis {
  identityDetected: boolean;
  bodyVisibility: string;
  quality: 'GOOD' | 'NEEDS ENHANCEMENT' | 'NEEDS REVIEW' | 'NOT VERIFIABLE';
  lighting?: string;
  pose?: string;
  existingClothing?: string;
}

export interface GarmentAnalysis {
  garmentType: string;
  shapeDetected: boolean;
  colorsDetected?: string[];
  patternLogos?: string;
  fabricNotes?: string;
  hiddenAreas?: string;
  status: 'GOOD' | 'NEEDS ENHANCEMENT' | 'NEEDS REVIEW' | 'NOT VERIFIABLE';
}

export interface PlayerAsset {
  dataUrl: string;
  fileName: string;
  aspectRatio?: number;
  analysis?: PlayerAnalysis;
  isSample?: boolean;
}

export interface GarmentAsset {
  slot: GarmentSlotId;
  dataUrl: string;
  fileName: string;
  name?: string;
  analysis?: GarmentAnalysis;
  isSample?: boolean;
}

export type GenerationMode = 'REALISTIC' | 'STUDIO' | 'CREATIVE';

export interface ColorCustomization {
  shirt?: string;
  pants?: string;
  shoes?: string;
  accessories?: string;
}

export interface CustomizationSettings {
  colors: ColorCustomization;
  faceExpression: string; // 'Original', 'Neutral', 'Confident', 'Smiling', 'Serious', 'Angry', 'Surprised', 'Custom'
  customFaceExpression?: string;
  hairStyle: string; // 'Original', 'Short', 'Long', 'Straight', 'Curly', 'Wavy', 'Buzz cut', 'Undercut', 'Fade', 'Custom'
  customHairStyle?: string;
  hairColor: string; // 'Original', 'Black', 'Dark Brown', 'Blonde', 'Platinum', 'Auburn', 'Silver', 'Custom'
  facialHair: string; // 'Original', 'Clean Shaven', 'Stubble', 'Short Beard', 'Full Beard'
  pose: string; // 'Original', 'Standing', 'Walking', 'Dynamic pose', 'Custom'
  customPose?: string;
  lighting: string; // 'Original', 'Studio soft light', 'Natural daylight', 'Dramatic lighting', 'Rim lighting'
  customPrompt: string;
  editTarget: 'Overall' | 'Clothing' | 'Face' | 'Hair' | 'Accessories';
  maskDataUrl?: string;
}

export interface LookVariation {
  id: string;
  imageUrl: string;
  label: string;
  index: number;
  transparentUrl?: string;
  shadowTransparentUrl?: string;
}

export interface ProjectVersion {
  id: string;
  name: string;
  createdAt: number;
  originalImage: string;
  generatedImage: string;
  transparentImage?: string;
  shadowTransparentImage?: string;
  mode: GenerationMode;
  aspectRatio: string;
  settingsSnapshot: CustomizationSettings;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  playerAsset: PlayerAsset;
  garments: Partial<Record<GarmentSlotId, GarmentAsset>>;
  activeVersionIndex: number;
  versions: ProjectVersion[];
  customization: CustomizationSettings;
  mode: GenerationMode;
}

export interface SavedOutfit {
  id: string;
  name: string;
  createdAt: number;
  garments: Partial<Record<GarmentSlotId, { name: string; dataUrl: string }>>;
  colors?: ColorCustomization;
}
