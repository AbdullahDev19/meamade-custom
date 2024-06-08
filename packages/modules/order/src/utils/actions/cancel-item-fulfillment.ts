import { MathBN, MedusaError, isDefined } from "@medusajs/utils"
import { ChangeActionType } from "../action-key"
import { OrderChangeProcessing } from "../calculate-order-change"

OrderChangeProcessing.registerActionType(
  ChangeActionType.CANCEL_ITEM_FULFILLMENT,
  {
    operation({ action, currentOrder }) {
      const existing = currentOrder.items.find(
        (item) => item.id === action.details.reference_id
      )!

      existing.detail.fulfilled_quantity ??= 0

      existing.detail.fulfilled_quantity = MathBN.sub(
        existing.detail.fulfilled_quantity,
        action.details.quantity
      )

      existing.detail.return_id = action.return_id
      existing.detail.swap_id = action.swap_id
      existing.detail.claim_id = action.claim_id
      existing.detail.exchange_id = action.exchange_id
    },
    revert({ action, currentOrder }) {
      const existing = currentOrder.items.find(
        (item) => item.id === action.reference_id
      )!

      existing.detail.fulfilled_quantity = MathBN.add(
        existing.detail.fulfilled_quantity,
        action.details.quantity
      )
    },
    validate({ action, currentOrder }) {
      const refId = action.details?.reference_id
      if (!isDefined(refId)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Reference ID is required."
        )
      }

      const existing = currentOrder.items.find((item) => item.id === refId)

      if (!existing) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Item ID "${refId}" not found.`
        )
      }

      if (!action.details?.quantity) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Quantity to cancel item fulfillment ${refId} is required.`
        )
      }

      if (action.details?.quantity < 1) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Quantity to cancel item ${refId} must be greater than 0.`
        )
      }

      const greater = MathBN.gt(
        action.details?.quantity,
        existing.detail?.fulfilled_quantity
      )
      if (greater) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Cannot cancel more items than what was fulfilled for item ${refId}.`
        )
      }
    },
  }
)
