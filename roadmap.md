

1. start testing api 


getRandomParagraph(req, res)
getParagraphById(req, res)
getPracticeTypes(req, res)

// updated — now tied to logged-in user
submitResult(req, res)
// body: { paragraphId, wpm, accuracy, errors, timeTaken, charsTyped }
// saves with userId from auth middleware

// new
getMyHistory(req, res)
// GET /practice/history — returns logged-in user's past results, paginated

getLeaderboard(req, res)