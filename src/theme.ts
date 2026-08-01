/** Shared color tokens, mirrored from src/index.css for use in inline styles. */
export const C = {
  red: '#BD202F',
  redHover: '#A81C2A',
  redTint: '#FBEAEC',
  ink: '#2D2D2D',
  body: '#4A4A4A',
  muted: '#6C757D',
  faint: '#ADB5BD',
  border: '#E5E7EB',
  canvas: '#F8F9FA',
  white: '#FFFFFF',
  toggleOff: '#CBD2D9',
  green: '#1E7E4F',
  greenTint: '#E7F3ED',
  amber: '#B45309',
  amberTint: '#FEF3C7',
} as const

/** White card surface used throughout the wizard. */
export const cardStyle: React.CSSProperties = {
  background: C.white,
  borderRadius: 12,
  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
  padding: 20,
}

/** Standard text input style. */
export const inputStyle: React.CSSProperties = {
  minHeight: 48,
  padding: '10px 14px',
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 500,
  color: C.body,
  width: '100%',
}
