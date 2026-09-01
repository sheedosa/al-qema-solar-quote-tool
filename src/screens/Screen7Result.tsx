import { C } from '../theme'
import { Card, Check } from '../components/ui'
import { useStrings } from '../i18n'
import type { EngineResult } from '../pricing/types'

function Metric({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string
  unit: string
  sub?: string
}) {
  return (
    <div style={{ background: C.canvas, borderRadius: 12, padding: '18px 14px', textAlign: 'center' }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.muted,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 23, fontWeight: 700, color: C.red, lineHeight: 1.2 }} dir="ltr">
        {value}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: C.muted }}>{unit}</div>
      {sub && (
        <div style={{ fontSize: 12, fontWeight: 400, color: C.faint, marginTop: 4 }} dir="auto">
          {sub}
        </div>
      )}
    </div>
  )
}

function Step({ n, children }: { n: number; children: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: C.redTint,
          color: C.red,
          fontSize: 13,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        {n}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, paddingTop: 2 }}>{children}</div>
    </div>
  )
}

/** Shared WhatsApp call-to-action, used by both the quote and survey results. */
function WhatsAppCta({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={(e) => (e.currentTarget.style.background = C.redHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = C.red)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minHeight: 52,
        borderRadius: 12,
        background: C.red,
        color: C.white,
        fontSize: 16,
        fontWeight: 600,
        textDecoration: 'none',
        transition: 'background 0.15s',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
        <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5 13.9c-.2.6-1.2 1.1-1.7 1.2-.4 0-1 .1-1.6-.1a13 13 0 01-1.5-.5c-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.8 2c.1.1.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.3 1.6z" />
      </svg>
      {label}
    </a>
  )
}

/**
 * Shown when the system is beyond what the form can price honestly. No number
 * is displayed — an estimate we would have to retract is worse than none.
 */
function SurveyResult({
  firstName,
  waLink,
  onStartOver,
  dailyKwh,
}: {
  firstName: string
  waLink: string
  onStartOver: () => void
  dailyKwh: number
}) {
  const s = useStrings()
  return (
    <div
      style={{
        animation: 'stepIn 0.35s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        paddingTop: 8,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            margin: '0 0 6px',
            fontSize: 25,
            fontWeight: 600,
            color: C.ink,
            lineHeight: 1.3,
            textWrap: 'pretty',
          }}
        >
          {s.result.surveyTitle + firstName}
        </h2>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: C.muted }}>
          {s.result.subtitle}
        </p>
      </div>

      <Card style={{ padding: '24px 20px' }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.body, textWrap: 'pretty' }}>
          {s.result.surveyBody}
        </p>
        <div style={{ marginTop: 16, fontSize: 13.5, color: C.muted }}>
          {s.result.dailyNeed} <span dir="ltr">{dailyKwh.toFixed(1)}</span>{' '}
          {s.result.kwhPerDay}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <WhatsAppCta href={waLink} label={s.result.surveyCta} />
        <button
          onClick={onStartOver}
          style={{
            minHeight: 48,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.body,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {s.result.startOver}
        </button>
      </div>
    </div>
  )
}

export function Screen7Result({
  result,
  firstName,
  priceVisible,
  waLink,
  onStartOver,
}: {
  result: EngineResult
  firstName: string
  priceVisible: boolean
  waLink: string
  onStartOver: () => void
}) {
  const s = useStrings()
  const r = result

  // Too large to price from a form. We deliberately show no number rather than
  // one the engineer would have to walk back.
  if (r.recommendedTier === 'SURVEY' || r.specs === null || r.priceFrom === null) {
    return (
      <SurveyResult
        firstName={firstName}
        waLink={waLink}
        onStartOver={onStartOver}
        dailyKwh={r.dailyKwh}
      />
    )
  }

  const specs = r.specs
  const priceText = s.result.priceFrom + r.priceFrom.toLocaleString('en-US') + ' ' + s.result.lyd

  return (
    <div
      style={{
        animation: 'stepIn 0.35s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        paddingTop: 8,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: C.greenTint,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.green}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2
          style={{
            margin: '0 0 6px',
            fontSize: 25,
            fontWeight: 600,
            color: C.ink,
            lineHeight: 1.3,
            textWrap: 'pretty',
          }}
        >
          {(r.isCustom ? s.result.customTitle : s.result.title) + firstName}
        </h2>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: C.muted }}>
          {s.result.subtitle}
        </p>
      </div>

      <Card style={{ padding: '24px 20px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: C.muted,
            textAlign: 'center',
            marginBottom: 6,
          }}
        >
          {s.result.recommendedPackage}
        </div>
        <div
          style={{
            fontSize: r.isCustom ? 30 : 38,
            fontWeight: 700,
            color: C.red,
            textAlign: 'center',
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          {r.isCustom ? s.result.customPackageName : s.result.packagePrefix + r.recommendedTier}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
            gap: 12,
          }}
        >
          <Metric
            label={s.result.solarPanels}
            value={specs.panels.kwp.toFixed(2)}
            unit={s.result.kwpArray}
            sub={specs.panels.count + ' × ' + specs.panels.watts + ' W'}
          />
          <Metric
            label={s.result.inverter}
            value={String(specs.inverter.kva)}
            unit={s.result.kva}
          />
          <Metric
            label={s.result.battery}
            value={String(specs.battery.nominalKwh)}
            unit={s.result.kwh}
            sub={
              (specs.battery.chemistry === 'liquid'
                ? s.result.batteryLiquid
                : s.result.batteryLithium) +
              ' · ' +
              (specs.battery.lifespanYears === 4
                ? s.result.batteryLife4
                : s.result.batteryLife10)
            }
          />
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontSize: 13.5,
            fontWeight: 500,
            color: C.muted,
          }}
        >
          {s.result.dailyNeed}{' '}
          <span style={{ color: C.body, fontWeight: 700 }}>
            {'~' + Math.round(r.dailyKwh) + ' ' + s.result.kwhPerDay}
          </span>
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: 4,
            fontSize: 13.5,
            fontWeight: 500,
            color: C.muted,
          }}
        >
          {s.result.nightNeed}{' '}
          <span style={{ color: C.body, fontWeight: 700 }}>
            {'~' + Math.round(r.nightKwh) + ' ' + s.result.kwhPerNight}
          </span>
        </div>
      </Card>

      {r.isCustom && (
        <div
          style={{
            background: C.redTint,
            borderRadius: 12,
            padding: '20px 18px',
            fontSize: 14.5,
            fontWeight: 500,
            color: C.body,
            lineHeight: 1.6,
            textAlign: 'center',
            textWrap: 'pretty',
          }}
        >
          {s.result.customBody}
        </div>
      )}

      {priceVisible && (
        <div style={{ background: C.ink, borderRadius: 12, padding: '24px 20px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: C.faint,
              marginBottom: 6,
            }}
          >
            {s.result.indicativePrice}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: C.white, lineHeight: 1.2 }}>
            {priceText}
          </div>
          <div style={{ fontSize: 13, fontWeight: 400, color: C.faint, marginTop: 6 }}>
            {s.result.priceNote}
          </div>
          {r.isCustom && (
            <div style={{ fontSize: 13, fontWeight: 400, color: C.faint, marginTop: 4 }}>
              {s.result.customPriceNote}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 400, color: C.faint, marginTop: 10, opacity: 0.7 }}>
            {s.result.priceRef}: {r.configVersion}
          </div>
        </div>
      )}

      {r.warnings.length > 0 && (
        <div
          style={{
            background: C.amberTint,
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>
            {s.result.warningsTitle}
          </div>
          {r.warnings.map((id) => (
            <div
              key={id}
              style={{ fontSize: 13.5, fontWeight: 500, color: C.body, lineHeight: 1.5 }}
            >
              {s.result.warnings[id]}
            </div>
          ))}
        </div>
      )}

      {r.confidence === 'low' && (
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
            {s.result.assumedTitle}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: C.muted,
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            {s.result.assumedBody}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {r.assumptionsMade.map((id) => (
              <div key={id} style={{ fontSize: 13.5, fontWeight: 500, color: C.body }}>
                · {s.result.assumptions[id]}
              </div>
            ))}
          </div>
        </Card>
      )}

      {r.includes.length > 0 && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 12 }}>
            {s.result.includesTitle}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {r.includes.map((id) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={15} />
                <span style={{ fontSize: 14, fontWeight: 500, color: C.body }}>
                  {s.result.includes[id]}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {r.runtimeHours !== null && (
              <div style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>
                {s.result.runtimeNote(r.runtimeHours)}
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>
              {s.result.warrantyNote}
            </div>
            {r.addOnsAvailable.length > 0 && (
              <div style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>
                {s.result.addOnLine(r.addOnsAvailable[0].priceLyd.toLocaleString('en-US'))}
              </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 400, color: C.faint }}>
              {s.result.termsNote}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 14 }}>
          {s.result.whatNext}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Step n={1}>{s.result.step1}</Step>
          <Step n={2}>{s.result.step2}</Step>
          <Step n={3}>{s.result.step3}</Step>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <WhatsAppCta href={waLink} label={s.result.whatsappCta} />
        <button
          onClick={onStartOver}
          style={{
            minHeight: 48,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.body,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {s.result.startOver}
        </button>
      </div>

      <div
        style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingBottom: 16,
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 500, color: C.muted }}>{s.result.trust}</div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: C.faint,
            maxWidth: 420,
            margin: '0 auto',
            lineHeight: 1.5,
            textWrap: 'pretty',
          }}
        >
          {s.result.disclaimer}
        </div>
      </div>
    </div>
  )
}
