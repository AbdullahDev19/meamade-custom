import { MedusaContainer } from "@medusajs/modules-sdk"
import {
  createCart as createCartWorkflow,
  Workflows,
} from "@medusajs/workflows"
import { Type } from "class-transformer"
import { ProductVariantDTO } from "@medusajs/types"

import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator"
import { isDefined, MedusaError } from "medusa-core-utils"
import reqIp from "request-ip"
import { EntityManager } from "typeorm"
import { FlagRouter, prepareLineItemData } from "@medusajs/utils"
import { defaultStoreCartFields, defaultStoreCartRelations } from "."
import SalesChannelFeatureFlag from "../../../../loaders/feature-flags/sales-channels"
import { LineItem } from "../../../../models"
import {
  CartService,
  LineItemService,
  ProductVariantService,
  RegionService,
} from "../../../../services"
import { CartCreateProps } from "../../../../types/cart"
import { cleanResponseData } from "../../../../utils/clean-response-data"
import { FeatureFlagDecorators } from "../../../../utils/feature-flag-decorators"
import { Logger } from "../../../../types/global"
import IsolateProductDomainFeatureFlag from "../../../../loaders/feature-flags/isolate-product-domain"
import { defaultAdminProductRemoteQueryObject } from "../../admin/products"

/**
 * @oas [post] /store/carts
 * operationId: "PostCart"
 * summary: "Create a Cart"
 * description: |
 *   Create a Cart. Although optional, specifying the cart's region and sales channel can affect the cart's pricing and
 *   the products that can be added to the cart respectively. So, make sure to set those early on and change them if necessary, such as when the customer changes their region.
 *
 *   If a customer is logged in, the cart's customer ID and email will automatically be set.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         $ref: "#/components/schemas/StorePostCartReq"
 * x-codegen:
 *   method: create
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       medusa.carts.create()
 *       .then(({ cart }) => {
 *         console.log(cart.id);
 *       });
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl -X POST '{backend_url}/store/carts'
 * tags:
 *   - Carts
 * responses:
 *   200:
 *     description: "Successfully created a new Cart"
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/StoreCartsRes"
 *   "400":
 *     $ref: "#/components/responses/400_error"
 *   "404":
 *     $ref: "#/components/responses/not_found_error"
 *   "409":
 *     $ref: "#/components/responses/invalid_state_error"
 *   "422":
 *     $ref: "#/components/responses/invalid_request_error"
 *   "500":
 *     $ref: "#/components/responses/500_error"
 */
export default async (req, res) => {
  const logger: Logger = req.scope.resolve("logger")
  const entityManager: EntityManager = req.scope.resolve("manager")
  const featureFlagRouter: FlagRouter = req.scope.resolve("featureFlagRouter")
  const cartService: CartService = req.scope.resolve("cartService")
  const productModuleService = req.scope.resolve("productModuleService")

  const validated = req.validatedBody as StorePostCartReq

  const reqContext = {
    ip: reqIp.getClientIp(req),
    user_agent: req.get("user-agent"),
  }

  const isWorkflowEnabled = featureFlagRouter.isFeatureEnabled({
    workflows: Workflows.CreateCart,
  })

  let cart

  if (isWorkflowEnabled && !productModuleService) {
    logger.warn(
      `Cannot run ${Workflows.CreateCart} workflow without '@medusajs/product' installed`
    )
  }

  if (isWorkflowEnabled && productModuleService) {
    const cartWorkflow = createCartWorkflow(req.scope as MedusaContainer)
    const input = {
      ...validated,
      publishableApiKeyScopes: req.publishableApiKeyScopes,
      context: {
        ...reqContext,
        ...validated.context,
      },
    }
    const { result, errors } = await cartWorkflow.run({
      input,
      context: {
        manager: entityManager,
      },
      throwOnError: false,
    })

    if (Array.isArray(errors)) {
      if (isDefined(errors[0])) {
        throw errors[0].error
      }
    }

    cart = result
  } else {
    const lineItemService: LineItemService =
      req.scope.resolve("lineItemService")
    const regionService: RegionService = req.scope.resolve("regionService")

    let regionId!: string
    if (isDefined(validated.region_id)) {
      regionId = validated.region_id as string
    } else {
      const regions = await regionService.list({})

      if (!regions?.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `A region is required to create a cart`
        )
      }

      regionId = regions[0].id
    }

    const toCreate: Partial<CartCreateProps> = {
      region_id: regionId,
      sales_channel_id: validated.sales_channel_id,
      context: {
        ...reqContext,
        ...validated.context,
      },
    }

    if (req.user && req.user.customer_id) {
      const customerService = req.scope.resolve("customerService")
      const customer = await customerService.retrieve(req.user.customer_id)
      toCreate["customer_id"] = customer.id
      toCreate["email"] = customer.email
    }

    if (validated.country_code) {
      toCreate["shipping_address"] = {
        country_code: validated.country_code.toLowerCase(),
      }
    }

    if (
      !toCreate.sales_channel_id &&
      req.publishableApiKeyScopes?.sales_channel_ids.length
    ) {
      if (req.publishableApiKeyScopes.sales_channel_ids.length > 1) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The PublishableApiKey provided in the request header has multiple associated sales channels."
        )
      }

      toCreate.sales_channel_id =
        req.publishableApiKeyScopes.sales_channel_ids[0]
    }

    cart = await entityManager.transaction(async (manager) => {
      const cartServiceTx = cartService.withTransaction(manager)
      const lineItemServiceTx = lineItemService.withTransaction(manager)

      const createdCart = await cartServiceTx.create(toCreate)

      if (validated.items?.length) {
        const productVariantService: ProductVariantService = req.scope.resolve(
          "productVariantService"
        )

        let variants
        const variantIds = validated.items
          .map((i) => i.variant_id)
          .filter(Boolean)

        if (
          featureFlagRouter.isFeatureEnabled(
            IsolateProductDomainFeatureFlag.key
          )
        ) {
          variants = await retrieveVariantsWithIsolatedProductModule(
            req,
            variantIds
          )
        } else {
          variants = (await productVariantService.withTransaction(manager).list(
            {
              id: variantIds,
            },
            { relations: ["product"] }
          )) as unknown as ProductVariantDTO[]
        }

        const generateInputData = validated.items.map((item) => {
          const variant = variants.find((v) => v.id === item.variant_id)!

          return prepareLineItemData(variant, item.quantity)
        })

        const generatedLineItems: LineItem[] = await lineItemServiceTx.generate(
          generateInputData,
          {
            region_id: regionId,
            customer_id: req.user?.customer_id,
          }
        )

        await cartServiceTx.addOrUpdateLineItems(
          createdCart.id,
          generatedLineItems,
          {
            validateSalesChannels:
              featureFlagRouter.isFeatureEnabled("sales_channels"),
          }
        )
      }

      return createdCart
    })
  }

  cart = await cartService.retrieveWithTotals(cart!.id, {
    select: defaultStoreCartFields,
    relations: defaultStoreCartRelations,
  })

  res.status(200).json({ cart: cleanResponseData(cart, []) })
}

async function retrieveVariantsWithIsolatedProductModule(
  req,
  variantsIds: string[]
) {
  const remoteQuery = req.scope.resolve("remoteQuery")

  const variantIdsMap = new Map(variantsIds.map((v) => [v, true]))

  const query = {
    product: {
      __args: { filters: { variants: { id: variantsIds } } },
      ...defaultAdminProductRemoteQueryObject,
    },
  }

  const { rows: products } = await remoteQuery(query)

  const variants: ProductVariantDTO[] = []

  products.forEach((product) => {
    product.profile_id = product.profile?.id
    product.variants.forEach((variant) => {
      if (variantIdsMap.has(variant.id)) {
        variant.product = product
        variants.push(variant)
      }
    })
  })

  return variants
}

export class Item {
  @IsNotEmpty()
  @IsString()
  variant_id: string

  @IsNotEmpty()
  @IsInt()
  quantity: number
}

/**
 * @schema StorePostCartReq
 * type: object
 * properties:
 *   region_id:
 *     type: string
 *     description: "The ID of the Region to create the Cart in. Setting the cart's region can affect the pricing of the items in the cart as well as the used currency.
 *      If this parameter is not provided, the first region in the store is used by default."
 *   sales_channel_id:
 *     type: string
 *     description: "The ID of the Sales channel to create the Cart in. The cart's sales channel affects which products can be added to the cart. If a product does not
 *      exist in the cart's sales channel, it cannot be added to the cart. If you add a publishable API key in the header of this request and specify a sales channel ID,
 *      the specified sales channel must be within the scope of the publishable API key's resources. If you add a publishable API key in the header of this request,
 *      you don't specify a sales channel ID, and the publishable API key is associated with one sales channel, that sales channel will be attached to the cart.
 *      If no sales channel is passed and no publishable API key header is passed or the publishable API key isn't associated with any sales channel,
 *      the cart will not be associated with any sales channel."
 *   country_code:
 *     type: string
 *     description: "The 2 character ISO country code to create the Cart in. Setting this parameter will set the country code of the shipping address."
 *     externalDocs:
 *      url: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements
 *      description: See a list of codes.
 *   items:
 *     description: "An array of product variants to generate line items from."
 *     type: array
 *     items:
 *       type: object
 *       required:
 *         - variant_id
 *         - quantity
 *       properties:
 *         variant_id:
 *           description: The ID of the Product Variant.
 *           type: string
 *         quantity:
 *           description: The quantity to add into the cart.
 *           type: integer
 *   context:
 *     description: "An object to provide context to the Cart. The `context` field is automatically populated with `ip` and `user_agent`"
 *     type: object
 *     example:
 *       ip: "::1"
 *       user_agent: "Chrome"
 */
export class StorePostCartReq {
  @IsOptional()
  @IsString()
  region_id?: string

  @IsOptional()
  @IsString()
  country_code?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Item)
  items?: Item[]

  @IsOptional()
  context?: object

  @FeatureFlagDecorators(SalesChannelFeatureFlag.key, [
    IsString(),
    IsOptional(),
  ])
  sales_channel_id?: string
}
