import Footer from '@klicker-uzh/shared-components/src/Footer'

function EvaluationFooter() {
  return (
    <Footer>
      {/* {currentInstance &&
      !showFeedbacks &&
      !showConfusion &&
      !showLeaderboard && (
        <div className="m-0 flex flex-row items-center justify-between py-2.5">
          <div className="text-lg" data-cy="session-total-participants">
            {t('manage.evaluation.totalParticipants', {
              number: currentInstance.participants,
            })}
          </div>
          <div className="flex flex-row items-center gap-7">
            <div className="ml-2 flex flex-row items-center gap-2">
              <Button
                onClick={() => {
                  settextSize({ type: 'decrease' })
                }}
                disabled={textSize.size === 'sm'}
                className={{
                  root: 'flex h-8 w-8 items-center justify-center',
                }}
                data={{ cy: 'decrease-font-size' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faMinus} />
                </Button.Icon>
              </Button>
              <Button
                onClick={() => {
                  settextSize({ type: 'increase' })
                }}
                disabled={textSize.size === 'xl'}
                className={{
                  root: 'flex h-8 w-8 items-center justify-center',
                }}
                data={{ cy: 'increase-font-size' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faPlus} />
                </Button.Icon>
              </Button>
              <FontAwesomeIcon icon={faFont} size="lg" />
              {t('manage.evaluation.fontSize')}
            </div>
            <Switch
              checked={showSolution}
              label={t('manage.evaluation.showSolution')}
              onCheckedChange={(newValue) => setShowSolution(newValue)}
            />
            <Select
              contentPosition="popper"
              className={{
                trigger: 'border-slate-400',
              }}
              items={ACTIVE_CHART_TYPES[
                currentInstance.questionData.type
              ].map((item) => {
                return {
                  label: t(item.label),
                  value: item.value,
                  data: { cy: `change-chart-type-${item.label}` },
                }
              })}
              value={chartType}
              onChange={(newValue: string) => setChartType(newValue)}
              data={{ cy: 'change-chart-type' }}
            />
          </div>
        </div>
      )} */}
    </Footer>
  )
}

export default EvaluationFooter
