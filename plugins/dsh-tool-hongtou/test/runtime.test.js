import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { apply } from '../lib/index.js'

test('插件 apply 在干净 Cordis 上下文中执行 /hongtou 并生成 XML', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-hongtou-runtime-'))
  let definition
  const ctx = {
    commands: { register: value => { definition = value; return () => {} } },
    sessionQuery: {
      readSession: async () => ({
        events: [
          { seq: 0, type: 'user/message', data: { text: '验证插件运行' } },
          { seq: 1, type: 'assistant/message', data: { text: '验证事项已记录。' } },
        ],
      }),
    },
    // 故意不提供 ctx.config；配置必须由 apply 的第二参数显式传入。
    llm: {},
    logger: { warn: () => {} },
  }

  try {
    apply(ctx, {})
    assert.equal(definition?.name, 'hongtou')
    const result = await definition.handler({
      agent: { session: { id: 'runtime-test', header: { cwd: workspace } } },
      rawInput: '本地安装完整性验证',
      signal: new AbortController().signal,
    })
    assert.equal(result.kind, 'success')
    assert.match(result.text, /DSH 内部文件章：已加盖/u)
    const outputDir = join(workspace, 'output')
    const files = await readdir(outputDir)
    assert.equal(files.length, 1)
    assert.match(files[0], /^红头公文_本地安装完整性验证_.*\.xml$/u)
    const xml = await readFile(join(outputDir, files[0]), 'utf8')
    assert.match(xml, /本地安装完整性验证/u)
    assert.match(xml, /<w:binData/u)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
