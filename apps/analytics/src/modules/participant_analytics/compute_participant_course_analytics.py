import pandas as pd
from datetime import datetime
from .compute_correctness import compute_correctness
from .aggregate_analytics import aggregate_analytics
from .save_participant_analytics import save_participant_analytics


def compute_participant_course_analytics(db, df_courses, verbose=False):
    # Count failure cases
    courses_without_responses = 0

    for idx, course in df_courses.iterrows():
        print(
            f"Computing participant analytics for course {idx} out of {len(df_courses)}"
        )
        course_id = course["id"]
        course_start_date = course["startDate"]
        course_end_date = course["endDate"]
        course_id = course["id"]

        # Find all participants and corresponding linked responses through the participations
        participations = db.participation.find_many(
            where={"courseId": course_id},
            include={
                "participant": {
                    "include": {
                        "detailQuestionResponses": {
                            "where": {
                                "createdAt": {
                                    "gte": course_start_date,
                                    "lte": course_end_date,
                                }
                            },
                        },
                        "questionResponses": True,
                    }
                }
            },
        )

        # Create a dataframe containing all detail responses
        participations_dict = list(map(lambda x: x.dict(), participations))
        details_dict = list(
            map(
                lambda x: x["participant"]["detailQuestionResponses"],
                participations_dict,
            )
        )
        responses_dict = list(
            map(lambda x: x["participant"]["questionResponses"], participations_dict)
        )

        details = [item for sublist in details_dict for item in sublist]
        responses = [item for sublist in responses_dict for item in sublist]
        if len(details) == 0 or len(responses) == 0:
            courses_without_responses += 1
            print(
                "No detail responses or response entries found for course {}".format(
                    course_id
                )
            )
            continue

        # Create pandas dataframe containing all question responses and details
        df_details = pd.DataFrame(details)
        df_responses = pd.DataFrame(responses)
        df_responses = df_responses[
            [
                "courseId",
                "participantId",
                "firstResponseCorrectness",
                "lastResponseCorrectness",
            ]
        ]

        # Add the course start and end dates to the dataframe
        df_details["course_start_date"] = course_start_date
        df_details["course_end_date"] = course_end_date
        df_details["courseId"] = course_id

        # Compute the correctness of each question response detail
        df_details, df_element_instances = compute_correctness(db, df_details, verbose)

        if df_details is None:
            print(
                f"No participant responses found for {course_start_date} to {course_end_date}."
            )
            del df_details
            del df_element_instances
            continue

        # Compute participant analytics (score/xp counts and correctness statistics)
        df_analytics = aggregate_analytics(df_details, df_responses)

        # Save the aggreagted analytics into the database
        end_curr_date = datetime.now().strftime("%Y-%m-%d") + "T23:59:59.999Z"
        course_end_date_ext = course_end_date.strftime("%Y-%m-%d") + "T23:59:59.999Z"
        timestamp = (
            course_end_date_ext
            if course_end_date_ext < end_curr_date
            else end_curr_date
        )
        save_participant_analytics(db, df_analytics, timestamp, "COURSE")

        # Delete the dataframes to avoid conflicts in the next iteration
        del df_details
        del df_element_instances
        del df_analytics

    return courses_without_responses
