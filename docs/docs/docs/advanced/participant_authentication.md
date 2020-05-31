---
id: participant_authentication
title: Participant Authentication
---

Participant authentication allows to restrict access to your polls. There are two ways to do that.

1. **Password Distribution:** After your upload of a list of arbitrary usernames/pseudonyms, we generate a list of 
username-password combinations that you can distribute to your participants.

2. **SwitchAAI:** After your upload of a list of SwitchAAI accounts (exact matches by email), participants will 
get access to your KlickerUZH session using their personal SwitchAAI login. Therefore, you will not be able to emulate any of your participants.

Step by step guide for participant authentication.

1. Create a session

![Create Session](assets/create_session_participants.gif)

2. Define participants and choose complete or aggregated results

**Complete Results:** The results of a session will be stored in a way that makes accessible individual participant responses and the corresponding username.

**Aggregated Results:** The results of a session will only be stored in an aggregated format, making it impossible to derive the responses of individual participants.

![Define Participants](assets/set_participants.gif)

3. Get participants list

![Get Participants](assets/get_participants.gif)

4. Participants can now log in with the password they got from the participants list (copied in the GIF before).

![Log In](assets/log_in.gif)