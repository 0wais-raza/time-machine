export type PartSlot =
  | "cpu"
  | "gpu"
  | "ram"
  | "storage"
  | "psu"
  | "cooling"
  | "case"
  | "lighting"
  | "audio"
  | "peripheral"
  | "display";

export interface HardwarePart {
  id: string;
  slot: PartSlot;
  name: string;
  brand: string;
  /** Price in Cyber Credits. */
  price: number;
  /** Market demand 1-5. */
  demand: number;
  /** Performance / value rating 1-5. */
  value: number;
  /** Key live specs shown in the rig view. */
  specs: Record<string, string>;
}

export const SLOTS: { slot: PartSlot; label: string; core: boolean }[] = [
  { slot: "cpu", label: "Processor", core: true },
  { slot: "gpu", label: "Graphics", core: true },
  { slot: "ram", label: "Memory", core: true },
  { slot: "storage", label: "Storage", core: true },
  { slot: "psu", label: "Power Supply", core: true },
  { slot: "cooling", label: "Cooling", core: true },
  { slot: "case", label: "Chassis", core: true },
  { slot: "lighting", label: "Lighting", core: false },
  { slot: "audio", label: "Hi-Fi Audio", core: false },
  { slot: "display", label: "Display", core: false },
  { slot: "peripheral", label: "Peripherals", core: false },
];

export const CATALOG: HardwarePart[] = [
  // CPU
  { id: "cpu-r5", slot: "cpu", brand: "AMD", name: "Ryzen 5 7600X", price: 120, demand: 4, value: 4, specs: { Cores: "6C / 12T", Boost: "5.3 GHz", TDP: "105W" } },
  { id: "cpu-r7", slot: "cpu", brand: "AMD", name: "Ryzen 7 9800X3D", price: 320, demand: 5, value: 5, specs: { Cores: "8C / 16T", Boost: "5.2 GHz", Cache: "96MB 3D V-Cache" } },
  { id: "cpu-i9", slot: "cpu", brand: "Intel", name: "Core i9-14900K", price: 380, demand: 3, value: 4, specs: { Cores: "24C / 32T", Boost: "6.0 GHz", TDP: "253W" } },
  { id: "cpu-tr", slot: "cpu", brand: "AMD", name: "Threadripper 7970X", price: 900, demand: 2, value: 3, specs: { Cores: "32C / 64T", Boost: "5.3 GHz", TDP: "350W" } },
  // GPU
  { id: "gpu-4060", slot: "gpu", brand: "NVIDIA", name: "RTX 4060 Ti", price: 180, demand: 4, value: 3, specs: { VRAM: "16GB GDDR6", Cores: "4352 CUDA", TGP: "165W" } },
  { id: "gpu-4080", slot: "gpu", brand: "NVIDIA", name: "RTX 4080 Super", price: 480, demand: 5, value: 4, specs: { VRAM: "16GB GDDR6X", Cores: "10240 CUDA", TGP: "320W" } },
  { id: "gpu-5090", slot: "gpu", brand: "NVIDIA", name: "RTX 5090", price: 1100, demand: 5, value: 5, specs: { VRAM: "32GB GDDR7", Cores: "21760 CUDA", TGP: "575W" } },
  { id: "gpu-7900", slot: "gpu", brand: "AMD", name: "Radeon RX 7900 XTX", price: 420, demand: 3, value: 4, specs: { VRAM: "24GB GDDR6", Cores: "6144 Stream", TGP: "355W" } },
  // RAM
  { id: "ram-16", slot: "ram", brand: "Corsair", name: "Vengeance 16GB DDR5", price: 60, demand: 3, value: 3, specs: { Capacity: "16GB (2x8)", Speed: "5600 MT/s", Latency: "CL36" } },
  { id: "ram-32", slot: "ram", brand: "G.Skill", name: "Trident Z5 32GB DDR5", price: 130, demand: 5, value: 5, specs: { Capacity: "32GB (2x16)", Speed: "6400 MT/s", Latency: "CL32" } },
  { id: "ram-64", slot: "ram", brand: "Kingston", name: "Fury Renegade 64GB", price: 260, demand: 3, value: 4, specs: { Capacity: "64GB (2x32)", Speed: "6000 MT/s", Latency: "CL30" } },
  // Storage
  { id: "ssd-1tb", slot: "storage", brand: "Samsung", name: "990 Pro 1TB NVMe", price: 70, demand: 5, value: 5, specs: { Capacity: "1TB", Read: "7450 MB/s", Interface: "PCIe 4.0" } },
  { id: "ssd-4tb", slot: "storage", brand: "WD", name: "Black SN850X 4TB", price: 240, demand: 4, value: 4, specs: { Capacity: "4TB", Read: "7300 MB/s", Interface: "PCIe 4.0" } },
  { id: "hdd-8tb", slot: "storage", brand: "Seagate", name: "IronWolf 8TB", price: 90, demand: 2, value: 3, specs: { Capacity: "8TB", RPM: "7200", Interface: "SATA III" } },
  // PSU
  { id: "psu-650", slot: "psu", brand: "Corsair", name: "RM650e 650W", price: 55, demand: 3, value: 4, specs: { Wattage: "650W", Rating: "80+ Gold", Modular: "Full" } },
  { id: "psu-1000", slot: "psu", brand: "Seasonic", name: "Vertex GX-1000", price: 140, demand: 4, value: 5, specs: { Wattage: "1000W", Rating: "80+ Gold", Modular: "Full" } },
  { id: "psu-1600", slot: "psu", brand: "be quiet!", name: "Dark Power Pro 1600W", price: 320, demand: 2, value: 3, specs: { Wattage: "1600W", Rating: "80+ Titanium", Modular: "Full" } },
  // Cooling
  { id: "cool-air", slot: "cooling", brand: "Noctua", name: "NH-D15 G2", price: 65, demand: 4, value: 5, specs: { Type: "Dual-tower air", Fans: "2x 140mm", Noise: "24 dBA" } },
  { id: "cool-360", slot: "cooling", brand: "Arctic", name: "Liquid Freezer III 360", price: 95, demand: 5, value: 5, specs: { Type: "360mm AIO", Fans: "3x 120mm", Pump: "PWM" } },
  { id: "cool-custom", slot: "cooling", brand: "EKWB", name: "Custom Loop Kit", price: 340, demand: 2, value: 3, specs: { Type: "Hard-line loop", Radiators: "2x 360mm", Coolant: "Clear" } },
  // Case
  { id: "case-mid", slot: "case", brand: "Fractal", name: "North Mid Tower", price: 80, demand: 4, value: 5, specs: { Form: "Mid ATX", Panel: "Walnut / mesh", Fans: "2 incl." } },
  { id: "case-o11", slot: "case", brand: "Lian Li", name: "O11 Dynamic EVO", price: 110, demand: 5, value: 5, specs: { Form: "Mid ATX", Panel: "Dual tempered glass", Fans: "0 incl." } },
  { id: "case-sff", slot: "case", brand: "SSUPD", name: "Meshlicious SFF", price: 95, demand: 3, value: 4, specs: { Form: "Mini-ITX", Volume: "14.9L", Panel: "Mesh" } },
  // Lighting
  { id: "light-strip", slot: "lighting", brand: "Corsair", name: "iCUE LS100 Strip Kit", price: 35, demand: 3, value: 3, specs: { LEDs: "138 addressable", Zones: "4", Sync: "iCUE" } },
  { id: "light-fans", slot: "lighting", brand: "Lian Li", name: "Uni Fan SL Infinity x3", price: 70, demand: 5, value: 4, specs: { Fans: "3x 120mm", LEDs: "ARGB dual-ring", Daisy: "Yes" } },
  { id: "light-panel", slot: "lighting", brand: "Nanoleaf", name: "Shapes Hex Panels", price: 90, demand: 4, value: 3, specs: { Panels: "9 hex", Sync: "Screen mirror", Color: "16M" } },
  // Audio
  { id: "audio-dac", slot: "audio", brand: "FiiO", name: "K11 DAC / Amp", price: 75, demand: 3, value: 5, specs: { DAC: "CS43198", Output: "1400mW", Rate: "384kHz / 32bit" } },
  { id: "audio-hd", slot: "audio", brand: "Sennheiser", name: "HD 660S2", price: 220, demand: 4, value: 5, specs: { Type: "Open-back", Impedance: "300Ω", Driver: "38mm" } },
  { id: "audio-mon", slot: "audio", brand: "Kali", name: "LP-6 V2 Monitors", price: 190, demand: 3, value: 4, specs: { Type: "Studio pair", Woofer: "6.5\"", SPL: "115dB" } },
  { id: "audio-mic", slot: "audio", brand: "Shure", name: "SM7dB Broadcast Mic", price: 200, demand: 4, value: 4, specs: { Pattern: "Cardioid", Preamp: "Built-in +28dB", Mount: "XLR" } },
  // Display
  { id: "disp-1440", slot: "display", brand: "LG", name: "27GP850 1440p 180Hz", price: 150, demand: 5, value: 5, specs: { Panel: "Nano IPS", Refresh: "180Hz", Response: "1ms" } },
  { id: "disp-oled", slot: "display", brand: "ASUS", name: "PG32UCDM 4K OLED", price: 420, demand: 5, value: 4, specs: { Panel: "QD-OLED", Refresh: "240Hz", HDR: "True Black 400" } },
  { id: "disp-ultra", slot: "display", brand: "Samsung", name: "Odyssey G9 Ultrawide", price: 380, demand: 3, value: 3, specs: { Panel: "VA 49\"", Refresh: "240Hz", Ratio: "32:9" } },
  // Peripherals
  { id: "kb-75", slot: "peripheral", brand: "Keychron", name: "Q1 Pro Mechanical", price: 90, demand: 5, value: 5, specs: { Layout: "75%", Switches: "Hot-swap", Build: "CNC aluminum" } },
  { id: "mouse-sup", slot: "peripheral", brand: "Logitech", name: "G Pro X Superlight 2", price: 85, demand: 5, value: 5, specs: { Weight: "60g", Sensor: "Hero 2 32K", Battery: "95h" } },
  { id: "chair-erg", slot: "peripheral", brand: "Herman Miller", name: "Aeron Remastered", price: 450, demand: 4, value: 4, specs: { Support: "PostureFit SL", Mesh: "8Z Pellicle", Warranty: "12y" } },
  { id: "desk-mat", slot: "peripheral", brand: "Grovemade", name: "Wool Felt Desk Pad", price: 30, demand: 2, value: 3, specs: { Size: "Large", Material: "Merino wool", Finish: "Leather trim" } },
];

export const partById = (id: string): HardwarePart | undefined =>
  CATALOG.find((p) => p.id === id);