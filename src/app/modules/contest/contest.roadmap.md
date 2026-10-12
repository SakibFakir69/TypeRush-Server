

Method	Endpoint	Purpose

POST	/api/v1/contests	Admin creates a contest

PATCH	/api/v1/contests/:id	Admin updates an upcoming contest

GET	/api/v1/contests	List upcoming, live, and completed contests

GET	/api/v1/contests/:id	Get contest details and countdown

POST	/api/v1/contests/:id/join	Register for a contest

GET	/api/v1/contests/:id/arena	Get paragraph and contest timing when permitted

POST	/api/v1/contests/:id/submit	Submit the final typing result

GET	/api/v1/contests/:id/leaderboard	Get final or live rankings