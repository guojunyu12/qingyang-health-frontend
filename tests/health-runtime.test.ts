import { test, expect, vi } from 'vitest';
import { healthApi, installHealthRuntime } from '../src/features/health/runtime';
test('health profile retries preserve caller idempotency key', async () => {
 const request=vi.fn().mockResolvedValue({version:1});
 installHealthRuntime({request,invalidateHealth:()=>{},subscribeSession:()=>()=>{}});
 const body={version:0,goalType:'balanced' as const,targetWeightKg:60,waterTargetMl:2000,calorieTargetKcal:1800};
 const key='c5a2e682-b73e-4adb-9c5f-a3050fc04bf2';
 await healthApi.saveProfile(body,key);
 expect(request).toHaveBeenCalledWith('/me/health-profile',{method:'PUT',body,idempotencyKey:key});
});

test('a definite business rejection releases the key; uncertain commits retain it',async()=>{
 const {shouldRetainCommandKey}=await import('../src/features/health/hooks');
 const {ApiError}=await import('../src/lib/api/client');
 expect(shouldRetainCommandKey(new ApiError(409,'WATER_DAILY_LIMIT','limit'))).toBe(false);
 expect(shouldRetainCommandKey(new ApiError(422,'VALIDATION_ERROR','invalid'))).toBe(false);
 expect(shouldRetainCommandKey(new ApiError(409,'REQUEST_IN_PROGRESS','pending'))).toBe(true);
 expect(shouldRetainCommandKey(new ApiError(500,'INTERNAL_ERROR','unknown'))).toBe(true);
 expect(shouldRetainCommandKey(new TypeError('network lost'))).toBe(true);
});
