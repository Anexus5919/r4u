import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { useTestDb } from '../../test/db.js'
import { MessageModel, NotificationModel, ReviewModel, UserModel } from '../../models/index.js'

useTestDb()

const app = createApp()
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function account(email: string, role: 'user' | 'reviewer' = 'user') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'CorrectHorse7Battery' })
  const id = res.body.data.user.id as string
  if (role === 'reviewer') await UserModel.updateOne({ _id: id }, { $set: { role } })
  return { id, token: res.body.data.accessToken as string }
}

async function requestReview() {
  const owner = await account('aman@example.com')
  const reviewer = await account('neha@example.com', 'reviewer')
  const resume = await request(app)
    .post('/api/resumes')
    .set(auth(owner.token))
    .send({ title: 'Backend CV', resumeType: 'technical' })
  const review = await request(app)
    .post('/api/reviews')
    .set(auth(owner.token))
    .send({ resumeId: resume.body.data.resume.id, reviewerId: reviewer.id })
  return { owner, reviewer, reviewId: review.body.data.review.id as string }
}

describe('notifications', () => {
  it('tells the reviewer about a new request, and filters by unread and review', async () => {
    const { reviewer } = await requestReview()

    const all = await request(app).get('/api/notifications').set(auth(reviewer.token))
    expect(all.body.data.unread).toBe(1)
    expect(all.body.data.notifications[0].type).toBe('review_requested')
    expect(all.body.data.notifications[0].actorName).toBe('aman')

    const review = await request(app)
      .get('/api/notifications?filter=review')
      .set(auth(reviewer.token))
    expect(review.body.data.notifications).toHaveLength(1)
  })

  it('marks one read, then all read', async () => {
    const { reviewer, owner, reviewId } = await requestReview()
    await request(app)
      .patch(`/api/reviews/${reviewId}/respond`)
      .set(auth(reviewer.token))
      .send({ accept: true })

    const list = await request(app).get('/api/notifications').set(auth(owner.token))
    const id = list.body.data.notifications[0]._id
    const marked = await request(app)
      .patch('/api/notifications/read')
      .set(auth(owner.token))
      .send({ ids: [id] })
    expect(marked.body.data.unread).toBe(0)

    const reviewerAll = await request(app)
      .patch('/api/notifications/read-all')
      .set(auth(reviewer.token))
    expect(reviewerAll.body.data.unread).toBe(0)
  })

  it('never lets one user read another user notifications', async () => {
    const { reviewer } = await requestReview()
    const stranger = await account('divya@example.com')
    const theirs = await NotificationModel.findOne({ user: reviewer.id })
    await request(app)
      .patch('/api/notifications/read')
      .set(auth(stranger.token))
      .send({ ids: [String(theirs?._id)] })
    expect((await NotificationModel.findById(theirs?._id))?.readAt).toBeNull()
  })

  it('refuses a second open request to the same reviewer for the same resume', async () => {
    const { owner, reviewer } = await requestReview()
    const resumes = await request(app).get('/api/resumes').set(auth(owner.token))
    const again = await request(app)
      .post('/api/reviews')
      .set(auth(owner.token))
      .send({ resumeId: resumes.body.data.resumes[0].id, reviewerId: reviewer.id })
    expect(again.status).toBe(422)
  })
})

describe('account deletion cascade', () => {
  it('removes reviews, messages and notifications along with the account', async () => {
    const { owner, reviewer, reviewId } = await requestReview()
    await MessageModel.create({ review: reviewId, sender: owner.id, body: 'hi', clientId: 'c1' })

    const res = await request(app).delete('/api/users/me').set(auth(owner.token))
    expect(res.status).toBe(204)

    expect(await ReviewModel.countDocuments({ _id: reviewId })).toBe(0)
    expect(await MessageModel.countDocuments({ review: reviewId })).toBe(0)
    expect(await NotificationModel.countDocuments({ user: owner.id })).toBe(0)
    expect(await UserModel.exists({ _id: reviewer.id })).toBeTruthy()
  })
})
