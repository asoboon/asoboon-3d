export const HOTSPOT_NAMES = [
  '入口ガイド',
  'メインエリア',
  '体験ポイント',
  'ご案内スポット'
];

export function buildHotspots(bounds) {
  const sizeX = bounds.max.x - bounds.min.x;
  const sizeZ = bounds.max.z - bounds.min.z;
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;

  const points = [
    { x: centerX - sizeX * 0.22, z: centerZ + sizeZ * 0.25 },
    { x: centerX + sizeX * 0.18, z: centerZ + sizeZ * 0.08 },
    { x: centerX + sizeX * 0.12, z: centerZ - sizeZ * 0.26 },
    { x: centerX - sizeX * 0.18, z: centerZ - sizeZ * 0.18 }
  ];

  return points.map((p, index) => ({
    id: `area-${index + 1}`,
    title: HOTSPOT_NAMES[index] ?? `エリア ${index + 1}`,
    description:
      'ここは仮配置の案内ポイントです。後で実際のエリア名・説明・写真・動画・音声に差し替える前提のテスト用データです。',
    position: p,
    radius: Math.max(sizeX, sizeZ) * 0.08,
  }));
}
