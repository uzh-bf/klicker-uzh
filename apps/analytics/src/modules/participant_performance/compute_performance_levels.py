def compute_performance_levels(df_performance):
    # set the performance levels based on the quantiles
    first_qs = df_performance.firstErrorRate.quantile([0.25, 0.75])
    last_qs = df_performance.lastErrorRate.quantile([0.25, 0.75])
    total_qs = df_performance.totalErrorRate.quantile([0.25, 0.75])

    first_q1 = first_qs[0.25]
    first_q3 = first_qs[0.75]
    last_q1 = last_qs[0.25]
    last_q3 = last_qs[0.75]
    total_q1 = total_qs[0.25]
    total_q3 = total_qs[0.75]

    # set the performance levels based on the quantiles (inverse logic compared to activity - higher error rate is worse)
    df_performance["firstPerformance"] = "MEDIUM"
    df_performance.loc[
        df_performance.firstErrorRate <= first_q1, "firstPerformance"
    ] = "HIGH"
    df_performance.loc[
        df_performance.firstErrorRate >= first_q3, "firstPerformance"
    ] = "LOW"

    df_performance["lastPerformance"] = "MEDIUM"
    df_performance.loc[df_performance.lastErrorRate <= last_q1, "lastPerformance"] = (
        "HIGH"
    )
    df_performance.loc[df_performance.lastErrorRate >= last_q3, "lastPerformance"] = (
        "LOW"
    )

    df_performance["totalPerformance"] = "MEDIUM"
    df_performance.loc[
        df_performance.totalErrorRate <= total_q1, "totalPerformance"
    ] = "HIGH"
    df_performance.loc[
        df_performance.totalErrorRate >= total_q3, "totalPerformance"
    ] = "LOW"

    return df_performance
