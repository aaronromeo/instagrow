TODO List

* Create more follower interactions
- [ ] Get instagram followers via Request
- [ ] See which followers have new content via ???
- [ ] Like new content via Nightmare
- [ ] Figure out how to deploy as a serverless architecture (https://github.com/dwyl/learn-aws-lambda)
- [ ] Figure out how to use DynamoDB to store followers information

* Follow users based on hashtag and location

* Determine which users are MVPs and which are dead leads

* Unfollow dead leads (unless they have immunity)


------

Sample saved user data

CREATE TABLE accounts (
  instagram_id integer PRIMARY KEY,
  username text NOT NULL,
  last_interacted_at text,
  latest_media_id integer,
  has_liked integer,
  latest_media_url text
)

Account:
  123456: {
    "id": 123456,
    "username": "instagram.user",
    "lastPostedMediaId": 987654321,
    "last_interacted_at": ""
  }

Media:
  987654321: {
    mediaId: "46244123",
    url: "...",
    postedAt: "...",
    accountId: 123456,
    hasLiked: false
  }
