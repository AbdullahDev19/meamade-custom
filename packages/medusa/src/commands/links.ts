import Logger from "../loaders/logger"
import { initializeContainer } from "../loaders"
import { ContainerRegistrationKeys, isString } from "@medusajs/utils"
import { getResolvedPlugins } from "../loaders/helpers/resolve-plugins"
import { resolvePluginsLinks } from "../loaders/helpers/resolve-plugins-links"
import { getLinksExecutionPlanner } from "../loaders/medusa-app"
import { LinkMigrationsPlannerAction } from "@medusajs/types"
import checkbox, { Separator } from "@inquirer/checkbox"

const TERMINAL_SIZE = process.stdout.columns

type Action = "sync"

function groupByActionPlan(actionPlan: LinkMigrationsPlannerAction[]) {
  return actionPlan.reduce((acc, action) => {
    acc[action.action] ??= []

    acc[action.action].push(action)

    return acc
  }, {} as Record<"noop" | "notify" | "create" | "update" | "delete", LinkMigrationsPlannerAction[]>)
}

function displaySection({
  title,
  content,
}: {
  title: string
  content: string
}) {
  console.log(new Array(TERMINAL_SIZE).join("-"))
  console.log(title)
  console.log(content)
}

function buildLinkDescription(action: LinkMigrationsPlannerAction) {
  const { linkDescriptor } = action
  return `${linkDescriptor.fromModule} (${linkDescriptor.fromModel}) <> ${linkDescriptor.toModule} (${linkDescriptor.toModel}) (table: ${action.tableName})`
}

function showMessage(
  title: string,
  actionsOrContext: string | LinkMigrationsPlannerAction[]
) {
  const toCreateDescription = isString(actionsOrContext)
    ? actionsOrContext
    : actionsOrContext
        .map((action) => `- ${buildLinkDescription(action)}`)
        .join("\n")

  displaySection({
    title,
    content: toCreateDescription,
  })
}

async function askForLinksToDelete(actions: LinkMigrationsPlannerAction[]) {
  console.log("\n")
  const answer = await checkbox({
    message:
      "Select the link tables you want to delete, this means that those links are not defined anymore and will be removed from the database.",
    choices: [
      ...actions.map((action) => {
        return {
          name: buildLinkDescription(action),
          value: action,
          checked: true,
        }
      }),
      {
        name: "none",
        value: {
          action: "none",
        } as unknown as LinkMigrationsPlannerAction,
        checked: false,
      },
    ],
    validate: (answer) => {
      if (answer.length === 0) {
        return "Please select at least one choice"
      }

      if (
        answer.length > 1 &&
        answer.some(
          (choice) =>
            "value" in choice && (choice.value.action as string) === "none"
        )
      ) {
        return "'none' cannot be selected with other selected choices"
      }

      return true
    },
  })

  return answer.filter((a) => (a.action as string) !== "none")
}

async function askForLinksToUpdate(actions: LinkMigrationsPlannerAction[]) {
  let choiceIndex = 0

  const sqlToDisplay = {
    value: "",
  }

  const readline = require("readline")
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on("keypress", (str, key) => {
    if (key.name === "up") {
      choiceIndex = Math.max(0, choiceIndex - 1)
    }

    if (key.name === "down") {
      choiceIndex = Math.min(actions.length - 1, choiceIndex + 1)
    }

    sqlToDisplay.value = (actions[choiceIndex] as { sql: string }).sql
  })

  console.log("\n")
  const answer = await checkbox({
    message:
      "Select the link tables you want to delete, this means that those links are not defined anymore and will be removed from the database.",
    choices: [
      ...actions.map((action) => {
        return {
          name: action.tableName,
          value: action,
          checked: true,
        }
      }),
      {
        name: "none",
        value: {
          action: "none",
        } as unknown as LinkMigrationsPlannerAction,
        checked: false,
      },
      new Separator(sqlToDisplay.value),
    ],
    validate: (answer) => {
      if (answer.length === 0) {
        return "Please select at least one choice"
      }

      if (
        answer.length > 1 &&
        answer.some(
          (choice) =>
            "value" in choice && (choice.value.action as string) === "none"
        )
      ) {
        return "'none' cannot be selected with other selected choices"
      }

      return true
    },
  })

  return answer.filter((a) => (a.action as string) !== "none")
}

const main = async function ({ directory }) {
  const args = process.argv
  args.shift()
  args.shift()
  args.shift()

  const action = args[0] as Action

  if (action !== "sync") {
    return process.exit()
  }

  const container = await initializeContainer(directory)

  const configModule = container.resolve(
    ContainerRegistrationKeys.CONFIG_MODULE
  )

  const plugins = getResolvedPlugins(directory, configModule, true) || []
  const pluginLinks = await resolvePluginsLinks(plugins, container)

  Logger.info("Syncing links...")

  const planner = await getLinksExecutionPlanner({
    configModule,
    linkModules: pluginLinks,
    container,
    action: "run",
  })

  const actionPlan = await planner.createPlan()

  const groupActionPlan = groupByActionPlan(actionPlan)

  const toCreate = groupActionPlan.create ?? []
  if (toCreate.length) {
    showMessage("Links tables to be created", toCreate)
  }

  const toUpdate = groupActionPlan.update ?? []
  if (toUpdate.length) {
    showMessage("Links tables to be updated", toUpdate)
  }

  const toDelete = groupActionPlan.delete ?? []
  if (toDelete.length) {
    groupActionPlan.delete = await askForLinksToDelete(toDelete)
  }

  const toNotify = groupActionPlan.notify ?? []
  if (toNotify.length) {
    const answer = await askForLinksToUpdate(toNotify)
    groupActionPlan.update.push(
      ...answer.map((action) => {
        return {
          ...action,
          action: "update",
        } as LinkMigrationsPlannerAction
      })
    )
  }

  await planner.executePlan([
    ...(groupActionPlan.create ?? []),
    ...(groupActionPlan.update ?? []),
    ...(groupActionPlan.delete ?? []),
  ])

  console.log(new Array(TERMINAL_SIZE).join("-"))
  Logger.info("Links sync completed")
  process.exit()
}

export default main
