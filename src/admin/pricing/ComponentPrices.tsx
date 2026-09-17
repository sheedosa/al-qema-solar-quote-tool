/**
 * The component price list, made usable: search, grouped by an inferred
 * category, a "used by" badge per row, unpriced parts the large-system method
 * needs pinned at the top, and add / rename / delete with the guards the old
 * list only applied at save time.
 */
import { useMemo, useState } from 'react'
import { unpricedCommercialComponents } from '../../pricing/commercial'
import { domId } from '../../pricing/paths'
import type { PricingConfig } from '../../pricing/types'
import { C } from '../../theme'
import { Auto, Badge, Btn, FieldError, Ltr, Num, SectionCard, numStyle } from '../controls'
import { fmtNum, plural } from '../format'
import { useAdminLang } from '../i18n'
import { useMobileValue } from '../useIsMobile'
import { ConfigCell, useDraft } from './bound'
import { CATEGORY_ORDER, categorize, matchesSearch, renameComponent, usedBy } from './componentTools'
import type { ComponentCategory } from './componentTools'

function UsedByBadge({ name, cfg }: { name: string; cfg: PricingConfig }) {
  const { t } = useAdminLang()
  const u = usedBy(name, cfg)
  const key = u.household && u.commercial ? 'both' : u.household ? 'household' : u.commercial ? 'commercial' : 'none'
  return <Badge tone={key === 'none' ? 'neutral' : 'green'}>{t.pricing.usedBy[key]}</Badge>
}

export function ComponentPrices() {
  const { t, lang } = useAdminLang()
  const pr = t.pricing
  const d = useDraft()
  const isMobile = useMobileValue()
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState<number | null>(null)
  const [addError, setAddError] = useState('')
  // One slot each, so opening one row's action closes another's.
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null)
  const cfg = d.draft

  const grouped = useMemo(() => {
    if (!cfg) return new Map<ComponentCategory, string[]>()
    const m = new Map<ComponentCategory, string[]>()
    for (const name of Object.keys(cfg.components)) {
      if (!matchesSearch(name, query)) continue
      const cat = categorize(name, cfg)
      m.set(cat, [...(m.get(cat) ?? []), name])
    }
    return m
  }, [cfg, query])

  if (!cfg) return null
  const unpriced = unpricedCommercialComponents(cfg).filter((n) => matchesSearch(n, query))
  const total = Object.keys(cfg.components).length
  const shown = [...grouped.values()].reduce((n, l) => n + l.length, 0)
  const listErr = d.fieldErrors['components']

  const addUnpriced = (name: string, price: number) => {
    d.patch((c) => void (c.components[name] = price))
  }

  const submitNew = () => {
    const name = newName.trim()
    if (!name) return
    if (name in cfg.components) {
      setAddError(pr.nameTaken)
      return
    }
    if (newPrice === null || !Number.isFinite(newPrice) || newPrice < 0) {
      setAddError(pr.priceRequired)
      return
    }
    d.patch((c) => void (c.components[name] = newPrice))
    setNewName('')
    setNewPrice(null)
    setAddError('')
  }

  const rowStyle = {
    display: 'flex',
    flexDirection: isMobile ? ('column' as const) : ('row' as const),
    alignItems: isMobile ? ('stretch' as const) : ('center' as const),
    gap: isMobile ? 8 : 12,
    padding: '10px 0',
    borderTop: `1px solid ${C.border}`,
  }

  return (
    <SectionCard
      title={pr.componentPrices}
      blurb={pr.componentPricesBlurb}
      id="prices-components"
      end={<Badge>{fmtNum(total)}</Badge>}
    >
      <input
        className="admin-input"
        type="search"
        dir="auto"
        aria-label={pr.search}
        placeholder={pr.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-testid="component-search"
        style={{ ...numStyle, width: isMobile ? '100%' : 320, minWidth: 0, fontSize: isMobile ? 16 : 14 }}
      />

      {unpriced.length > 0 && (
        <div
          data-testid="unpriced-block"
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 10,
            background: C.amberTint,
            borderInlineStart: `3px solid ${C.amber}`,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.amber, textAlign: 'start' }}>
            {plural(unpricedCommercialComponents(cfg).length, pr.unpricedTitle, lang)}
          </div>
          <div style={{ fontSize: 12.5, color: C.body, lineHeight: 1.5, marginTop: 4, textAlign: 'start' }}>
            {pr.unpricedBlurb(fmtNum(cfg.commercial?.customerPath.takesOverAboveKw ?? 0))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {unpriced.map((name) => (
              <UnpricedRow key={name} name={name} onAdd={(p) => addUnpriced(name, p)} isMobile={isMobile} />
            ))}
          </div>
        </div>
      )}

      {shown === 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 14 }}>{pr.noMatches}</div>}

      {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => (
        <div key={cat} style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 2, textAlign: 'start' }}>
            {pr.category[cat]} <span style={{ fontWeight: 500 }}>({fmtNum(grouped.get(cat)!.length)})</span>
          </div>
          {grouped.get(cat)!.map((name) => (
            <div key={name} style={rowStyle} data-testid="component-row">
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {renaming && renaming.from === name ? (
                  <RenameBox
                    value={renaming.to}
                    onChange={(to) => setRenaming({ from: name, to })}
                    onCancel={() => setRenaming(null)}
                    onSave={() => {
                      d.patch((c) => void renameComponent(c, name, renaming.to))
                      setRenaming(null)
                    }}
                    taken={renaming.to.trim() !== name && renaming.to.trim() in cfg.components}
                  />
                ) : (
                  <>
                    <span style={{ fontSize: 14, color: C.body, textAlign: 'start' }}>
                      <Auto>{name}</Auto>
                    </span>
                    <UsedByBadge name={name} cfg={cfg} />
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 'none' }}>
                <div style={{ flex: isMobile ? 1 : 'none' }}>
                  <ConfigCell path={`components["${name}"]`} width={110} min={0} ariaLabel={name} />
                </div>
                <span style={{ fontSize: 13, color: C.muted, lineHeight: '44px', flex: 'none' }}>{t.common.currency}</span>
                <RowActions
                  name={name}
                  cfg={cfg}
                  confirming={confirmDel === name}
                  onConfirm={() => setConfirmDel(name)}
                  onCancel={() => setConfirmDel(null)}
                  onDelete={() => {
                    d.patch((c) => void delete c.components[name])
                    setConfirmDel(null)
                  }}
                  onRename={() => setRenaming({ from: name, to: name })}
                />
              </div>
            </div>
          ))}
        </div>
      ))}

      {listErr && <FieldError>{listErr.reason}</FieldError>}

      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 6, textAlign: 'start' }}>
          {pr.newComponent}
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center' }}>
          <input
            className="admin-input"
            placeholder={pr.newComponentName}
            aria-label={pr.newComponentName}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setAddError('')
            }}
            dir="auto"
            data-testid="new-component-name"
            style={{ ...numStyle, width: isMobile ? '100%' : 260, minWidth: 0, fontSize: isMobile ? 16 : 14 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Num
              value={newPrice}
              onChange={(n) => {
                setNewPrice(n)
                setAddError('')
              }}
              width={120}
              min={0}
              placeholder={pr.pricePlaceholder}
              ariaLabel={pr.pricePlaceholder}
            />
            <span style={{ fontSize: 13, color: C.muted, flex: 'none' }}>{t.common.currency}</span>
            <Btn onClick={submitNew} testId="add-component">
              {t.common.add}
            </Btn>
          </div>
        </div>
        {addError && <FieldError>{addError}</FieldError>}
        <div style={{ fontSize: 12, color: C.faint, marginTop: 10, textAlign: 'start' }}>{pr.categoryNote}</div>
      </div>
    </SectionCard>
  )
}

function UnpricedRow({ name, onAdd, isMobile }: { name: string; onAdd: (price: number) => void; isMobile: boolean }) {
  const { t } = useAdminLang()
  const [price, setPrice] = useState<number | null>(null)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: 8,
        padding: '8px 0',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.body, textAlign: 'start' }}>
        <Auto>{name}</Auto> <Badge tone="amber">{t.pricing.noPrice}</Badge>
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Num
          value={price}
          onChange={setPrice}
          width={120}
          min={0}
          placeholder={t.pricing.pricePlaceholder}
          ariaLabel={`${name} — ${t.pricing.pricePlaceholder}`}
        />
        <span style={{ fontSize: 13, color: C.muted, flex: 'none' }}>{t.common.currency}</span>
        <Btn
          kind="primary"
          disabled={price === null || !Number.isFinite(price) || price < 0}
          onClick={() => price !== null && onAdd(price)}
        >
          {t.pricing.commercial.addPrice}
        </Btn>
      </div>
    </div>
  )
}

function RenameBox({
  value,
  onChange,
  onSave,
  onCancel,
  taken,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  taken: boolean
}) {
  const { t } = useAdminLang()
  const isMobile = useMobileValue()
  const canSave = value.trim() !== '' && !taken
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="admin-input"
          dir="auto"
          autoFocus
          aria-label={t.pricing.renameTo}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) onSave()
            if (e.key === 'Escape') onCancel()
          }}
          style={{ ...numStyle, width: isMobile ? '100%' : 240, minWidth: 0, fontSize: isMobile ? 16 : 14 }}
        />
        <Btn kind="primary" disabled={!canSave} onClick={onSave}>
          {t.pricing.rename}
        </Btn>
        <Btn onClick={onCancel}>{t.common.cancel}</Btn>
      </div>
      {taken && <FieldError>{t.pricing.nameTaken}</FieldError>}
    </div>
  )
}

function RowActions({
  name,
  cfg,
  confirming,
  onConfirm,
  onCancel,
  onDelete,
  onRename,
}: {
  name: string
  cfg: PricingConfig
  confirming: boolean
  onConfirm: () => void
  onCancel: () => void
  onDelete: () => void
  onRename: () => void
}) {
  const { t } = useAdminLang()
  const u = usedBy(name, cfg)
  const blocked = u.household || u.commercial
  if (confirming) {
    return (
      <>
        <Btn onClick={onCancel}>{t.common.cancel}</Btn>
        <Btn kind="danger" onClick={onDelete}>
          {t.common.delete}
        </Btn>
      </>
    )
  }
  return (
    <>
      <Btn ariaLabel={t.pricing.rename + ' ' + name} title={t.pricing.rename} onClick={onRename} style={{ width: 44, padding: 0 }}>
        ✎
      </Btn>
      <Btn
        ariaLabel={t.pricing.removeComponent(name)}
        title={blocked ? t.pricing.deleteBlocked : t.pricing.removeComponent(name)}
        disabled={blocked}
        onClick={onConfirm}
        style={{ width: 44, padding: 0, fontSize: 18, color: C.muted }}
      >
        ×
      </Btn>
    </>
  )
}

/** Exported for the Advanced commercial section's ladder read-out. */
export function PriceStatus({ name, cfg }: { name: string; cfg: PricingConfig }) {
  const { t } = useAdminLang()
  const price = cfg.components[name]
  if (price === undefined) return <Badge tone="amber">{t.pricing.noPrice}</Badge>
  return (
    <Badge tone="green">
      <Ltr>{fmtNum(price)}</Ltr> {t.common.currency}
    </Badge>
  )
}

export const componentDomId = (name: string) => domId(`components["${name}"]`)
