import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { MessageModel, NotificationModel, ReviewModel, UserModel } from '../../models/index.js'
import { useTestDb } from '../../test/db.js'

useTestDb()

const app = createApp()
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
const PASSWORD = 'CorrectHorse7Battery'

async function account(email: string, role: 'user' | 'reviewer' = 'user') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: PASSWORD })
  const id = res.body.data.user.id as string
  if (role === 'reviewer') {
    await UserModel.updateOne(
      { _id: id },
      {
        $set: {
          role,
          reviewerProfile: {
            bio: '',
            expertise: ['Backend'],
            acceptingRequests: true,
            openSlots: 3,
          },
        },
      }
    )
  }
  return { id, token: res.body.data.accessToken as string }
}

/** An owner, a reviewer and a review they have both agreed to. */
async function activeReview() {
  const owner = await account('aman@example.com')
  const reviewer = await account('neha@example.com', 'reviewer')
  const created = await request(app)
    .post('/api/resumes')
    .set(auth(owner.token))
    .send({ title: 'Backend CV' })
  const resumeId = created.body.data.resume.id as string
  const asked = await request(app)
    .post('/api/reviews')
    .set(auth(owner.token))
    .send({ resumeId, reviewerId: reviewer.id })
  const reviewId = asked.body.data.review.id as string
  await request(app)
    .patch(`/api/reviews/${reviewId}/respond`)
    .set(auth(reviewer.token))
    .send({ accept: true })
  return { owner, reviewer, resumeId, reviewId }
}

// completion runs over the socket; the tests here only need its result
async function complete(reviewId: string) {
  await ReviewModel.updateOne(
    { _id: reviewId },
    { $set: { status: 'completed', completedAt: new Date() } }
  )
}

describe('PATCH /api/reviews/:id/resubmit', () => {
  it('moves the round on, posts the note to the chat and tells the reviewer', async () => {
    const { owner, reviewer, reviewId } = await activeReview()

    const res = await request(app)
      .patch(`/api/reviews/${reviewId}/resubmit`)
      .set(auth(owner.token))
      .send({ note: 'Moved the latency result to the top.' })

    expect(res.status).toBe(200)
    expect(res.body.data.review).toMatchObject({ round: 2, status: 'active' })
    expect(res.body.data.review.resubmittedAt).toBeTruthy()
    const message = await MessageModel.findOne({ review: reviewId })
    expect(message?.body).toBe('Moved the latency result to the top.')
    expect(String(message?.sender)).toBe(owner.id)
    expect(
      await NotificationModel.countDocuments({ user: reviewer.id, type: 'review_resubmitted' })
    ).toBe(1)
  })

  it('writes a default note when the owner leaves it empty', async () => {
    const { owner, reviewId } = await activeReview()
    await request(app).patch(`/api/reviews/${reviewId}/resubmit`).set(auth(owner.token)).send({})
    const message = await MessageModel.findOne({ review: reviewId })
    expect(message?.body).toMatch(/another look/)
  })

  it('is the owner’s move only', async () => {
    const { reviewer, reviewId } = await activeReview()
    const res = await request(app)
      .patch(`/api/reviews/${reviewId}/resubmit`)
      .set(auth(reviewer.token))
      .send({})
    expect(res.status).toBe(403)
  })

  it('refuses a review that is not in progress', async () => {
    const { owner, reviewId } = await activeReview()
    await complete(reviewId)
    const res = await request(app)
      .patch(`/api/reviews/${reviewId}/resubmit`)
      .set(auth(owner.token))
      .send({})
    expect(res.status).toBe(422)
  })

  it('answers a stranger with 404', async () => {
    const { reviewId } = await activeReview()
    const stranger = await account('someone@example.com')
    const res = await request(app)
      .patch(`/api/reviews/${reviewId}/resubmit`)
      .set(auth(stranger.token))
      .send({})
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/reviews/:id/rating', () => {
  it('records the owner’s rating of a completed review and tells the reviewer once', async () => {
    const { owner, reviewer, reviewId } = await activeReview()
    await complete(reviewId)

    const first = await request(app)
      .patch(`/api/reviews/${reviewId}/rating`)
      .set(auth(owner.token))
      .send({ rating: 4, note: 'Clear and quick.' })
    expect(first.status).toBe(200)
    expect(first.body.data.review).toMatchObject({ rating: 4, ratingNote: 'Clear and quick.' })

    await request(app)
      .patch(`/api/reviews/${reviewId}/rating`)
      .set(auth(owner.token))
      .send({ rating: 5 })
    expect(
      await NotificationModel.countDocuments({ user: reviewer.id, type: 'review_rated' })
    ).toBe(1)
  })

  it('waits until the review is completed', async () => {
    const { owner, reviewId } = await activeReview()
    const res = await request(app)
      .patch(`/api/reviews/${reviewId}/rating`)
      .set(auth(owner.token))
      .send({ rating: 5 })
    expect(res.status).toBe(422)
  })

  it('rejects a rating outside 1 to 5, and a reviewer rating themselves', async () => {
    const { owner, reviewer, reviewId } = await activeReview()
    await complete(reviewId)
    const bad = await request(app)
      .patch(`/api/reviews/${reviewId}/rating`)
      .set(auth(owner.token))
      .send({ rating: 9 })
    expect(bad.status).toBe(422)
    const self = await request(app)
      .patch(`/api/reviews/${reviewId}/rating`)
      .set(auth(reviewer.token))
      .send({ rating: 5 })
    expect(self.status).toBe(403)
  })
})

describe('GET /api/users/reviewers', () => {
  it('shows each reviewer’s record from real reviews, never their email', async () => {
    const { owner, reviewId } = await activeReview()
    await complete(reviewId)
    await request(app)
      .patch(`/api/reviews/${reviewId}/rating`)
      .set(auth(owner.token))
      .send({ rating: 4 })

    const res = await request(app).get('/api/users/reviewers').set(auth(owner.token))

    expect(res.status).toBe(200)
    const [card] = res.body.data.reviewers
    expect(card).not.toHaveProperty('email')
    expect(card.record).toMatchObject({ completed: 1, active: 0, rating: 4, ratings: 1 })
    expect(card.record.replyHours).toBeGreaterThanOrEqual(0)
    expect(card.slotsFree).toBe(3)
  })

  it('counts reviews in progress against the open slots', async () => {
    const { owner } = await activeReview()
    const res = await request(app).get('/api/users/reviewers').set(auth(owner.token))
    const [card] = res.body.data.reviewers
    expect(card.record).toMatchObject({ completed: 0, active: 1, rating: null, ratings: 0 })
    expect(card.slotsFree).toBe(2)
  })
})
