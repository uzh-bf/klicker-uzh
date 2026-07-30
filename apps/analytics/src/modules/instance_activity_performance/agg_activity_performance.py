def agg_activity_performance(df_instance_performance, participant_count):
    activity_performance = df_instance_performance.mean()
    activity_performance.drop("instanceId", inplace=True)
    activity_performance["participantCount"] = participant_count
    activity_performance.to_dict()

    return activity_performance
