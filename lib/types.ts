export interface CriteriaOptions {
  gemstones: string[];
  locations: string[];
}

export interface NormalEntrySubmission {
  packet_no: string;
  gemstone: string;
  entry_numbers: string[];
}

export interface LotEntryInput {
  lot_no: string;
  no_of_pcs: number;
  total_carat_ct: number;
  comments?: string;
  location: string;
  gemstone: string;
}

export interface NoPktEntrySubmission {
  location: string;
  gemstone: string;
  entry_numbers: string[];
}
