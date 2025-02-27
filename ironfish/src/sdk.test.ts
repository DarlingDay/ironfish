/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import os from 'os'
import { Config, DEFAULT_DATA_DIR } from './fileStores'
import { NodeFileProvider } from './fileSystems'
import { IronfishNode } from './node'
import { Platform } from './platform'
import {
  ALL_API_NAMESPACES,
  RpcClient,
  RpcIpcAdapter,
  RpcMemoryClient,
  RpcTcpAdapter,
} from './rpc'
import { RpcIpcClient } from './rpc/clients/ipcClient'
import { RpcTcpClient } from './rpc/clients/tcpClient'
import { IronfishSdk } from './sdk'
import { Wallet } from './wallet'

describe('IronfishSdk', () => {
  describe('init', () => {
    it('should initialize an SDK', async () => {
      const dataDir = os.tmpdir()

      const fileSystem = new NodeFileProvider()
      await fileSystem.init()

      const sdk = await IronfishSdk.init({
        configName: 'foo.config.json',
        dataDir: dataDir,
        fileSystem: fileSystem,
      })

      expect(sdk.config).toBeInstanceOf(Config)
      expect(sdk.client).toBeInstanceOf(RpcClient)
      expect(sdk.fileSystem).toBe(fileSystem)

      expect(sdk.config.storage.dataDir).toBe(dataDir)
      expect(sdk.config.storage.configPath).toContain('foo.config.json')
    })

    it('should detect platform defaults', async () => {
      const sdk = await IronfishSdk.init({ dataDir: os.tmpdir() })
      const runtime = Platform.getRuntime()

      expect(sdk.fileSystem).toBeInstanceOf(NodeFileProvider)
      expect(runtime.type).toBe('node')
    })

    it('should create a node', async () => {
      const fileSystem = new NodeFileProvider()
      await fileSystem.init()

      const sdk = await IronfishSdk.init({
        configName: 'foo.config.json',
        dataDir: os.tmpdir(),
        fileSystem: fileSystem,
      })

      const node = await sdk.node({ databaseName: 'foo' })

      expect(node).toBeInstanceOf(IronfishNode)
      expect(node.files).toBe(fileSystem)
      expect(node.config).toBe(sdk.config)
      expect(node.wallet).toBeInstanceOf(Wallet)
      expect(node.config.get('databaseName')).toBe('foo')
    })

    it('should initialize an SDK with the default dataDir if none is passed in', async () => {
      const fileSystem = new NodeFileProvider()
      await fileSystem.init()

      const sdk = await IronfishSdk.init({
        configName: 'foo.config.json',
        fileSystem: fileSystem,
      })

      const expectedDir = fileSystem.resolve(DEFAULT_DATA_DIR)
      expect(sdk.config.dataDir).toBe(expectedDir)
      expect(sdk.config.storage.dataDir).toBe(expectedDir)

      const node = await sdk.node({ databaseName: 'foo' })
      expect(node.config).toBe(sdk.config)
    })
  })

  describe('connectRpc', () => {
    describe('when local is true', () => {
      it('returns and connects `clientMemory` to a node', async () => {
        const sdk = await IronfishSdk.init()
        const node = await sdk.node()
        const openDb = jest.spyOn(node, 'openDB').mockImplementationOnce(async () => {})
        jest.spyOn(sdk, 'node').mockResolvedValueOnce(node)

        const client = await sdk.connectRpc(true)

        expect(openDb).toHaveBeenCalledTimes(1)
        expect(client).toBeInstanceOf(RpcMemoryClient)
        expect((client as RpcMemoryClient).node).toBe(node)
      })
    })

    describe('when local is false', () => {
      it('connects to and returns `RpcIpcClient`', async () => {
        const sdk = await IronfishSdk.init()
        const connect = jest.spyOn(sdk.client, 'connect').mockImplementationOnce(async () => {})

        const client = await sdk.connectRpc(false)

        expect(connect).toHaveBeenCalledTimes(1)
        expect(client).toBeInstanceOf(RpcIpcClient)
        expect(client).toMatchObject(sdk.client)
      })
    })

    describe('when local is false and enableRpcTcp is true', () => {
      it('connects to and returns `RpcTcpClient`', async () => {
        const sdk = await IronfishSdk.init({
          configOverrides: {
            enableRpcTcp: true,
          },
        })

        const connect = jest.spyOn(sdk.client, 'connect').mockImplementationOnce(async () => {})

        const client = await sdk.connectRpc(false)

        expect(connect).toHaveBeenCalledTimes(1)
        expect(client).toBeInstanceOf(RpcTcpClient)
        expect(client).toMatchObject(sdk.client)
      })
    })
  })

  describe('RPC adapters', () => {
    it('should use all RPC namespaces for IPC', async () => {
      const sdk = await IronfishSdk.init({
        dataDir: os.tmpdir(),
        configOverrides: {
          enableRpcIpc: true,
        },
      })

      const node = await sdk.node()
      const ipc = node.rpc.adapters.find<RpcIpcAdapter>(
        (a): a is RpcIpcAdapter => a instanceof RpcIpcAdapter,
      )

      expect(ipc?.namespaces).toEqual(ALL_API_NAMESPACES)
    })

    it('should use all RPC namespaces for TCP', async () => {
      const sdk = await IronfishSdk.init({
        dataDir: os.tmpdir(),
        configOverrides: {
          enableRpcTcp: true,
          enableRpcTls: false,
        },
      })

      const node = await sdk.node()
      const tcp = node.rpc.adapters.find<RpcTcpAdapter>(
        (a): a is RpcTcpAdapter => a instanceof RpcTcpAdapter,
      )

      expect(tcp?.namespaces.sort()).toEqual(ALL_API_NAMESPACES.sort())
    })
  })
})
