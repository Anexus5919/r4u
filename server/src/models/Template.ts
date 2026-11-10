import { Schema, model } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'

// metadata plus a design preset over a code renderer; there is no field that could hold markup
const templateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    baseKey: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    builtIn: { type: Boolean, default: false },
    defaults: {
      accent: { type: String, maxlength: 20 },
      typeScale: { type: Number, min: 9.5, max: 11.5 },
      leading: { type: Number, min: 1.2, max: 1.45 },
      sectionSpacing: { type: String, enum: ['compact', 'normal', 'airy'] },
      margins: { type: Number, min: 16, max: 25 },
    },
  },
  { timestamps: true }
)

templateSchema.index({ active: 1, order: 1 })

export type Template = InferSchemaType<typeof templateSchema>
export type TemplateDoc = HydratedDocument<Template>
export const TemplateModel = model('Template', templateSchema)
