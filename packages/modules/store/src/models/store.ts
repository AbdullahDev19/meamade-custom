import { model } from "@medusajs/utils"
import { StoreCurrency } from "./index"

const Store = model.define("store", {
  id: model.id({ prefix: "store" }).primaryKey(),
  name: model.text().default("Medusa Store").searchable(),
  supported_currencies: model.hasMany(() => StoreCurrency, {
    mappedBy: "store",
  }),
  default_currency_code: model.text().nullable(),
  default_sales_channel_id: model.text().nullable(),
  default_region_id: model.text().nullable(),
  default_location_id: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default Store
