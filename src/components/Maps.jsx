import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fmtNumber } from '../lib/format'

export const GHANA_CENTER = [7.95, -1.03]

// Pin made from an icon font, so no marker images need bundling
const pin = (hot) => L.divIcon({
  className: 'fl-map-pin',
  html: `<i class="bi bi-geo-alt-fill" style="color:${hot ? '#D08A2C' : '#05402E'}"></i>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
  popupAnchor: [0, -26],
})

const Tiles = () => (
  <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
)

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick([Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]) })
  return null
}

function FitTo({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 12)
    else if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 12 })
  }, [map, points])
  return null
}

// Landowner drops a pin on their plot
export function MapPicker({ value, onChange, height = 300 }) {
  const has = value && value[0] != null && value[1] != null
  return (
    <div>
      <MapContainer center={has ? value : GHANA_CENTER} zoom={has ? 13 : 7} style={{ height }} className="fl-map rounded-4">
        <Tiles />
        <ClickToPick onPick={onChange} />
        {has && <Marker position={value} icon={pin(true)} draggable eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onChange([Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]) } }} />}
      </MapContainer>
      <div className="d-flex flex-wrap justify-content-between gap-2 small text-muted-fl mt-2">
        <span><i className="bi bi-hand-index me-1" />Tap the map to place the pin, drag it to adjust.</span>
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => navigator.geolocation?.getCurrentPosition((p) => onChange([Number(p.coords.latitude.toFixed(6)), Number(p.coords.longitude.toFixed(6))]))}>
          <i className="bi bi-crosshair me-1" />Use my location
        </button>
      </div>
    </div>
  )
}

// One plot, read-only
export function PlotMap({ lat, lng, height = 260 }) {
  if (lat == null || lng == null) return <div className="fl-card text-center text-muted-fl small py-5">No map location given</div>
  const pos = [Number(lat), Number(lng)]
  return (
    <MapContainer center={pos} zoom={13} style={{ height }} className="fl-map rounded-4" scrollWheelZoom={false}>
      <Tiles />
      <Marker position={pos} icon={pin(true)} />
    </MapContainer>
  )
}

// Search results on a map
export function PlotsMap({ plots, linkPrefix = '/find/', height = 520 }) {
  const located = plots.filter((p) => p.latitude != null && p.longitude != null)
  const points = located.map((p) => [Number(p.latitude), Number(p.longitude)])
  return (
    <MapContainer center={GHANA_CENTER} zoom={7} style={{ height }} className="fl-map rounded-4">
      <Tiles />
      <FitTo points={points} />
      {located.map((p) => (
        <Marker key={p.id} position={[Number(p.latitude), Number(p.longitude)]} icon={pin(false)}>
          <Popup>
            <strong>{p.title}</strong><br />
            {fmtNumber(p.size_acres)} acres · {p.soil_type}<br />
            <Link to={`${linkPrefix}${p.id}`}>View plot</Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
