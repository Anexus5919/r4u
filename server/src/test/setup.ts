// runs before imports, since config/env.ts validates at import time
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'fatal'
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/r4u-test'
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-long-enough-000000'
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-00000'
process.env.BCRYPT_ROUNDS ??= '4'
