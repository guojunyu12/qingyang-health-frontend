import {test,expect,vi,afterEach} from 'vitest';
import {uploadImage} from '../src/lib/api/uploads';
import {api} from '../src/lib/api/client';
vi.mock('../src/lib/api/client',()=>({api:vi.fn()}));
afterEach(()=>{vi.unstubAllGlobals();vi.resetAllMocks()});
test('meal image reuses M01 csrf/cookie upload and waits ready, with stable operation key',async()=>{
 vi.stubGlobal('location',new URL('http://localhost:3001'));
 const file={name:'meal.png',type:'image/png',size:4,arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer} as File;
 vi.mocked(api).mockResolvedValueOnce({assetId:'asset',uploadUrl:'http://localhost:3001/api/v1/uploads/local/asset',requiredHeaders:{'Content-Type':'image/png'},method:'PUT',maxSizeBytes:100}).mockResolvedValueOnce({status:'pending'}).mockResolvedValueOnce({csrfToken:'csrf'}).mockResolvedValueOnce({status:'validating'}).mockResolvedValueOnce({status:'ready'});
 const fetch=vi.fn().mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal('fetch',fetch);
 expect(await uploadImage(file,'meal_photo',{operationKey:'stable'})).toBe('asset');
 expect(fetch.mock.calls[0][1].credentials).toBe('include');
 expect(fetch.mock.calls[0][1].headers['X-CSRF-Token']).toBe('csrf');
 expect(vi.mocked(api).mock.calls[0][1]?.body).toMatchObject({purpose:'meal_photo'});
 expect(vi.mocked(api).mock.calls[0][1]?.idempotencyKey).toBe('stable');
 expect(vi.mocked(api).mock.calls[3][1]?.idempotencyKey).toBe('stable');
});
test('signed upload cannot leak site credentials to a foreign URL',async()=>{
 vi.stubGlobal('location',new URL('http://localhost:3001'));
 const file={name:'meal.png',type:'image/png',size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer} as File;
 vi.mocked(api).mockResolvedValueOnce({assetId:'asset',uploadUrl:'https://untrusted.example/upload',requiredHeaders:{},method:'PUT',maxSizeBytes:100});
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 await expect(uploadImage(file,'meal_photo')).rejects.toThrow('上传地址');expect(fetch).not.toHaveBeenCalled();
});
test('retry after a lost completion response reuses ready asset without uploading again',async()=>{
 vi.stubGlobal('location',new URL('http://localhost:3001'));
 const file={name:'meal.png',type:'image/png',size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer} as File;
 vi.mocked(api).mockResolvedValueOnce({assetId:'asset',uploadUrl:'http://localhost:3001/api/v1/uploads/local/asset',requiredHeaders:{},method:'PUT'}).mockResolvedValueOnce({status:'ready'});
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 expect(await uploadImage(file,'meal_photo',{operationKey:'original'})).toBe('asset');expect(fetch).not.toHaveBeenCalled();
});

 test('retry while validation is running polls without sending another PUT or complete',async()=>{
  vi.stubGlobal('location',new URL('http://localhost:3001'));
  const file={name:'meal.png',type:'image/png',size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer} as File;
  vi.mocked(api).mockResolvedValueOnce({assetId:'asset',uploadUrl:'http://localhost:3001/api/v1/uploads/local/asset',requiredHeaders:{},method:'PUT'}).mockResolvedValueOnce({status:'validating'}).mockResolvedValueOnce({status:'ready'});
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  expect(await uploadImage(file,'meal_photo',{operationKey:'original'})).toBe('asset');expect(fetch).not.toHaveBeenCalled();
  expect(vi.mocked(api).mock.calls.map(call=>call[0])).toEqual(['/uploads/presign','/uploads/asset','/uploads/asset']);
 });
