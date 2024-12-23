def get_course_progress_activities(db, course_id):
    pqs = db.practicequiz.find_many(
        where={"courseId": course_id},
        include={"stacks": {"include": {"elements": True}}, "responses": True},
    )
    pqs = list(map(lambda x: x.dict(), pqs))

    mls = db.microlearning.find_many(
        where={"courseId": course_id},
        include={"stacks": {"include": {"elements": True}}, "responses": True},
    )
    mls = list(map(lambda x: x.dict(), mls))

    return pqs, mls
