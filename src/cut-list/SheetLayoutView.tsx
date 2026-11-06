import { useMemo, useState } from 'react'
import { DraftField } from '../components/DraftField'
import type { CutListItem } from '../domain/cutlist/deriveCutList'
import {
  deriveSheetLayout,
  type SheetPriority,
} from '../domain/cutlist/sheetLayout'
import { useTranslation } from '../i18n'
import {
  loadSheetPreference,
  saveSheetPreference,
  SHEET_SIZES,
  type SheetPreference,
} from '../store/sheetStockPreference'
import { formatSheetSize } from '../units'
import { useMeasure } from '../units/useMeasure'
import { CUT_LIST_GROUPS } from './partGroups'
import { SheetDrawing } from './SheetDrawing'

const CUSTOM = 'custom'
const sizeKey = (length: number, width: number) => `${length}x${width}`

/** Presentation of the canonical cut list rows laid out on sheets. */
export function SheetLayoutView({ items }: { items: CutListItem[] }) {
  const { t } = useTranslation()
  const { unit, measure } = useMeasure()
  const [stock, setStock] = useState(() => loadSheetPreference(unit))
  const sizes = SHEET_SIZES[unit]
  const standard = sizes.some(
    ([length, width]) => length === stock.length && width === stock.width,
  )
  const [custom, setCustom] = useState(!standard)
  const layout = useMemo(
    () => deriveSheetLayout(items, stock, stock.priority),
    [items, stock],
  )
  const update = (change: Partial<SheetPreference>) => {
    const next = { ...stock, ...change }
    setStock(next)
    saveSheetPreference(unit, next)
  }
  const sheets = layout.groups.reduce(
    (sum, group) => sum + group.sheets.length,
    0,
  )
  const cuts = layout.groups.reduce((sum, group) => sum + group.cuts, 0)
  return (
    <div className="sheet-layout cut-list-scroll">
      <div className="sheet-controls">
        <label className="property-field">
          <span>{t('sheets.size')}</span>
          <select
            value={custom ? CUSTOM : sizeKey(stock.length, stock.width)}
            onChange={(event) => {
              const chosen = sizes.find(
                ([length, width]) =>
                  sizeKey(length, width) === event.target.value,
              )
              setCustom(!chosen)
              if (chosen) update({ length: chosen[0], width: chosen[1] })
            }}
          >
            {sizes.map(([length, width]) => (
              <option
                key={sizeKey(length, width)}
                value={sizeKey(length, width)}
              >
                {formatSheetSize(length, width, unit)}
              </option>
            ))}
            <option value={CUSTOM}>{t('sheets.custom')}</option>
          </select>
        </label>
        {custom && (
          <>
            <DraftField
              key={`length-${stock.length}`}
              label={t('sheets.length')}
              numeric
              value={stock.length}
              onCommit={(value) => {
                if (Number(value) <= 0) return false
                update({ length: Number(value) })
              }}
            />
            <DraftField
              key={`width-${stock.width}`}
              label={t('sheets.width')}
              numeric
              value={stock.width}
              onCommit={(value) => {
                if (Number(value) <= 0) return false
                update({ width: Number(value) })
              }}
            />
          </>
        )}
        <DraftField
          key={`kerf-${stock.kerf}`}
          label={t('sheets.kerf')}
          numeric
          value={stock.kerf}
          onCommit={(value) => {
            if (Number(value) < 0) return false
            update({ kerf: Number(value) })
          }}
        />
        <label className="property-field">
          <span>{t('sheets.priority')}</span>
          <select
            value={stock.priority}
            onChange={(event) =>
              update({ priority: event.target.value as SheetPriority })
            }
          >
            <option value="cuts">{t('sheets.fewestCuts')}</option>
            <option value="sheets">{t('sheets.fewestSheets')}</option>
          </select>
        </label>
        <p className="sheet-total" role="status">
          <strong>{t('count.sheets', { count: sheets })}</strong>
          <span>{t('count.cuts', { count: cuts })}</span>
        </p>
      </div>
      {layout.tooLarge.length > 0 && (
        <p className="field-error" role="alert">
          {t('sheets.tooLarge', {
            parts: layout.tooLarge.map((item) => item.id).join(', '),
          })}
        </p>
      )}
      <ul className="sheet-legend">
        {CUT_LIST_GROUPS.map(({ id, titleKey }) => (
          <li key={id} data-group={id}>
            {t(titleKey)}
          </li>
        ))}
      </ul>
      {layout.groups.map((group) => (
        <section key={group.thickness} className="sheet-group">
          <h2>
            {t('sheets.thick', { thickness: measure(group.thickness) })}{' '}
            <small>
              {t('count.sheets', { count: group.sheets.length })} ·{' '}
              {t('count.cuts', { count: group.cuts })} ·{' '}
              {t('sheets.waste', { percent: Math.round(group.waste * 100) })}
            </small>
          </h2>
          <div className="sheet-grid">
            {group.sheets.map((sheet, index) => {
              const name = t('sheets.sheet', { number: index + 1 })
              const summary = `${t('count.parts', { count: sheet.parts.length })} · ${t('count.cuts', { count: sheet.cuts.length })}`
              return (
                <figure key={index}>
                  <figcaption>
                    <strong>{name}</strong> {summary}
                  </figcaption>
                  <SheetDrawing
                    sheet={sheet}
                    stock={stock}
                    unit={unit}
                    label={`${name}, ${measure(group.thickness)}: ${summary}. ${sheet.parts.map((part) => part.id).join(', ')}`}
                  />
                </figure>
              )
            })}
          </div>
        </section>
      ))}
      <p className="cut-list-note">
        {t('sheets.note', {
          unit: t(unit === 'inch' ? 'unit.inchPlural' : 'unit.mmPlural'),
        })}
      </p>
    </div>
  )
}
