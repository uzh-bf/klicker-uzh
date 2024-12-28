def get_course_activities(db, course_id):
    pqs = db.practicequiz.find_many(
        where={"courseId": course_id},
        include={"stacks": {"include": {"elements": {"include": {"responses": True}}}}},
    )
    pqs = list(map(lambda x: x.dict(), pqs))

    mls = db.microlearning.find_many(
        where={"courseId": course_id},
        include={"stacks": {"include": {"elements": {"include": {"responses": True}}}}},
    )
    mls = list(map(lambda x: x.dict(), mls))

    return pqs, mls
