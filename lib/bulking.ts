import {
  BulkIndexOptions,
  BulkInstruction,
  BulkOptions,
  BulkUnIndexOptions,
  MongoosasticDocument,
  MongoosasticModel,
} from './types'

let bulkBuffer: BulkInstruction[] = []
let bulkTimeout: NodeJS.Timeout | undefined

function clearBulkTimeout() {
  clearTimeout(bulkTimeout as NodeJS.Timeout)
  bulkTimeout = undefined
}

export async function bulkAdd(opts: BulkIndexOptions): Promise<void> {
  const instruction = [
    {
      index: {
        _index: opts.index,
        _id: opts.id,
      },
    },
    opts.body,
  ]

  await bulkIndex(opts.model, instruction, opts.bulk as BulkOptions)
}

export async function bulkDelete(opts: BulkUnIndexOptions): Promise<void> {
  const instruction = [
    {
      delete: {
        _index: opts.index,
        _id: opts.id,
      },
    },
  ]

  await bulkIndex(opts.model, instruction, opts.bulk as BulkOptions)
}

export async function bulkIndex(
  model: MongoosasticModel<MongoosasticDocument>,
  instruction: BulkInstruction[],
  bulk: BulkOptions
): Promise<void> {
  bulkBuffer = bulkBuffer.concat(instruction)

  if (bulkBuffer.length >= bulk.size) {
    await model.flush()
    clearBulkTimeout()
  } else if (bulkTimeout === undefined) {
    bulkTimeout = setTimeout(async () => {
      await model.flush()
      clearBulkTimeout()
    }, bulk.delay)
  }
}

export async function flush(this: MongoosasticModel<MongoosasticDocument>): Promise<void> {
  this.esClient()
    .bulk({
      body: bulkBuffer,
    })
    .then((res) => {
      //@ts-ignore
      if (res.items && res.items.length) {
        //@ts-ignore
        for (let i = 0; i < res.items.length; i++) {
          //@ts-ignore
          const info = res.items[i]
          if (info && info.index && info.index.error) {
            this.bulkError().emit('error', null, info.index)
          }
        }
      }
    })
    .catch((error) => this.bulkError().emit('error', error, null))

  bulkBuffer = []
}
