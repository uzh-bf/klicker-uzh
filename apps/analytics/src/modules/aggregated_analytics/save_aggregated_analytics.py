from datetime import datetime
from src.modules.learning_analytics_eligibility import learning_analytics_write_transaction


def save_aggregated_analytics(db, df_analytics, timestamp, analytics_type="DAILY"):
    computedAt = datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z"

    # create daily / weekly / monthly analytics entries for all participants
    if analytics_type in ["DAILY", "WEEKLY", "MONTHLY"]:
        for _, row in df_analytics.iterrows():
            with learning_analytics_write_transaction(db, course_id=row["courseId"]) as transaction:
                if transaction is None:
                    continue
                transaction.aggregatedanalytics.upsert(
                    where={
                        "type_courseId_timestamp": {
                            "type": analytics_type,
                            "courseId": row["courseId"],
                            "timestamp": timestamp,
                        }
                    },
                    data={
                        "create": {
                            "type": analytics_type,
                            "timestamp": timestamp,
                            "computedAt": computedAt,
                            "participantCount": row["participantCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            # TODO: set this value correctly for rolling updates in production code
                            # (cannot be computed for past learning analytics -> therefore set to invalid value)
                            "totalElementsAvailable": -1,
                            "course": {"connect": {"id": row["courseId"]}},
                        },
                        "update": {},
                    },
                )

    # create or update course-wide analytics entries (should be unique for participant / course combination)
    elif analytics_type == "COURSE":
        for _, row in df_analytics.iterrows():
            with learning_analytics_write_transaction(db, course_id=row["courseId"]) as transaction:
                if transaction is None:
                    continue
                course = transaction.course.find_unique_or_raise(
                    where={"id": row["courseId"]},
                    include={
                        "practiceQuizzes": {
                            "include": {
                                "stacks": {
                                    "include": {"elements": True},
                                }
                            }
                        },
                        "microLearnings": {
                            "include": {
                                "stacks": {
                                    "include": {"elements": True},
                                }
                            }
                        },
                    },
                )
                course = dict(course)

                # add all the number of elements in all practice quizzes and microlearnings together
                totalElementsAvailable = 0
                for practice_quiz in course["practiceQuizzes"]:
                    pq_dict = dict(practice_quiz)
                    for stack in pq_dict["stacks"]:
                        stack_dict = dict(stack)
                        totalElementsAvailable += sum(
                            dict(element)["elementData"]["type"] != "FREE_TEXT" for element in stack_dict["elements"]
                        )
                for microlearning in course["microLearnings"]:
                    ml_dict = dict(microlearning)
                    for stack in ml_dict["stacks"]:
                        stack_dict = dict(stack)
                        totalElementsAvailable += sum(
                            dict(element)["elementData"]["type"] != "FREE_TEXT" for element in stack_dict["elements"]
                        )

                transaction.aggregatedanalytics.upsert(
                    where={
                        "type_courseId_timestamp": {
                            "type": analytics_type,
                            "courseId": row["courseId"],
                            "timestamp": timestamp,
                        }
                    },
                    data={
                        "create": {
                            "type": analytics_type,
                            "timestamp": timestamp,
                            "computedAt": computedAt,
                            "participantCount": row["participantCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            "totalElementsAvailable": totalElementsAvailable,
                            "course": {"connect": {"id": row["courseId"]}},
                        },
                        "update": {
                            "computedAt": computedAt,
                            "participantCount": row["participantCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            "totalElementsAvailable": totalElementsAvailable,
                        },
                    },
                )

    else:
        raise ValueError("Unknown analytics type: {}".format(analytics_type))
