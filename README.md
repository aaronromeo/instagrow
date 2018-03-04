# Instagrow

### Purpose


### Current Usage
➜  node src/index.js -h

  Usage: index [options] [command]

  Instagrow, an Instagram engagement tool


  Options:

    -V, --version  output the version number
    -h, --help     output usage information


  Commands:

    createDatabase|c <username>  Create an Instagram database to store activity
    likeMedia|l <username>       Create "like" interactions for followed accounts who have posted content in the last 3-7 days

### TODO List

* Create more follower interactions
- [ ] Figure out how to deploy as a serverless architecture (https://github.com/dwyl/learn-aws-lambda)
- [ ] Figure out how to use DynamoDB to store followers information

* Follow users based on hashtag and location

* Determine which users are MVPs and which are dead leads

* Unfollow dead leads (unless they have immunity)
