// Kombinerer flaskeinnsamling-soner og lapper-soner til ett FeatureCollection
import bottleZonesData from './zones-data'
import lapperZonesData from './lapper-zones-data'

const data: {
  type: string
  features: Array<{
    type: string
    properties: Record<string, string | number>
    geometry: { type: string; coordinates: number[][][] | number[][][][] }
  }>
} = {
  type: 'FeatureCollection',
  features: [
    ...bottleZonesData.features,
    ...lapperZonesData.features,
  ],
}
export default data
