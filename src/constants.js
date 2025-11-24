export const ROOM_TYPES = [
  { id: 'ldk', label: 'LDK', color: '#E6F3FF' }, // Light Blue
  { id: 'western', label: '洋室', color: '#FFF0F5' }, // Lavender Blush
  { id: 'japanese', label: '和室', color: '#F0FFF0' }, // Honeydew
  { id: 'storage', label: '収納', color: '#F5F5F5' }, // White Smoke
  { id: 'entrance', label: '玄関', color: '#FFFFE0' }, // Light Yellow
  { id: 'toilet', label: 'トイレ', color: '#E0FFFF' }, // Light Cyan
  { id: 'bath', label: '浴室', color: '#E0FFFF' }, // Light Cyan
  { id: 'wash', label: '洗面所', color: '#E0FFFF' }, // Light Cyan
  { id: 'corridor', label: '廊下', color: '#E8E8E8' }, // Light Gray
];

export const OBJECT_TYPES = [
  { id: 'door', label: 'ドア (Door)', width: 800, height: 800, type: 'opening' },
  { id: 'window', label: '引き違い窓 (Sliding Window)', width: 1600, height: 100, type: 'opening' },
  { id: 'fix_window', label: 'Fix窓 (Fix Window)', width: 1600, height: 100, type: 'opening' },
  { id: 'table', label: 'テーブル (Table)', width: 1500, height: 800, type: 'table' },
  { id: 'kitchen', label: 'キッチン (Kitchen)', width: 2550, height: 650, type: 'kitchen' },
  { id: 'toilet', label: 'トイレ (Toilet)', width: 400, height: 700, type: 'fixture' },
  { id: 'bath', label: '浴室 (Bath)', width: 1600, height: 1600, type: 'fixture' },
  { id: 'wash_basin', label: '洗面台 (Wash Basin)', width: 750, height: 550, type: 'wash_basin' },
  { id: 'bed', label: 'ベッド (Bed)', width: 1000, height: 2000, type: 'bed' },
  { id: 'sofa', label: 'ソファ (Sofa)', width: 1600, height: 850, type: 'sofa' },
  { id: 'washing_machine', label: '洗濯機 (Washing Machine)', width: 640, height: 640, type: 'washing_machine' },
  { id: 'tv_stand', label: 'テレビ台 (TV Stand)', width: 1500, height: 450, type: 'tv_stand' },
  { id: 'tv', label: 'テレビ (TV)', width: 1000, height: 150, type: 'tv' },
  { id: 'refrigerator', label: '冷蔵庫 (Refrigerator)', width: 700, height: 700, type: 'refrigerator' },
  { id: 'chair', label: '椅子 (Chair)', width: 450, height: 500, type: 'chair' },
  { id: 'work_chair', label: 'ワークチェア (Work Chair)', width: 450, height: 450, type: 'work_chair' },
];
