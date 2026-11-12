import {it,expect} from 'vitest'
import {readBoundedBytes} from './bounded-json'
it('counts chunked stream bytes, not headers',async()=>{const r=new Request('http://localhost',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(3));c.enqueue(new Uint8Array(3));c.close()}}),duplex:'half'} as RequestInit);await expect(readBoundedBytes(r,5)).rejects.toThrow(RangeError)})
it('allows exactly the byte boundary',async()=>{expect(await readBoundedBytes(new Request('http://localhost',{method:'POST',body:'12345'}),5)).toHaveLength(5)})
