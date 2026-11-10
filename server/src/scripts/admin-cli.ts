import { connectDb, disconnectDb } from '../config/db.js'
import { RefreshTokenModel, UserModel } from '../models/index.js'
import { deleteAccount } from '../modules/users/users.service.js'

// npm run admin --workspace=server -- <promote|demote|delete> <email>, against MONGODB_URI
// sign-up always creates a user, so this is the only way an administrator comes to exist

const USAGE = 'usage: npm run admin --workspace=server -- <promote|demote|delete> <email>'
const [command, rawEmail] = process.argv.slice(2)
const email = rawEmail?.trim().toLowerCase()

if (!command || !email || !['promote', 'demote', 'delete'].includes(command)) {
  console.error(USAGE)
  process.exit(1)
}

await connectDb()

try {
  const user = await UserModel.findOne({ email })
  if (!user) {
    console.error(`No account with the email ${email}. Register it first, then run this again.`)
    process.exitCode = 1
  } else if (command === 'delete') {
    await deleteAccount(user.id)
    console.warn(`Deleted ${email} and everything it owned.`)
  } else {
    user.role = command === 'promote' ? 'admin' : 'user'
    // every request re-reads tokenVersion, so this ends each session now; open sockets fail on reconnect
    user.tokenVersion += 1
    await user.save()
    await RefreshTokenModel.deleteMany({ user: user._id })
    console.warn(`${email} is now ${user.role === 'admin' ? 'an admin' : 'a user'}. Sign in again.`)
  }
} finally {
  await disconnectDb()
}
