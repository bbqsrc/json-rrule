"use strict"

const moment = require("moment")
require("moment-timezone")

function isoString(x) {
  const yy = x.substring(0, 4)
  const mm = x.substring(4, 6)
  const dd = x.substring(6, 8)

  const h = x.substring(9, 11)
  const m = x.substring(11, 13)
  const s = x.substring(13, 15)
  return `${yy}-${mm}-${dd}T${h}:${m}:${s}.000Z`
}

const DAYS = [
  "SU", "MO", "TU", "WE", "TH", "FR", "SA"
]

function parseRule(rule) {
  if (!rule.startsWith("RRULE")) {
    return null
  }

  const chunks = rule.substring(6).replace(/\s+/g, "").split(";").map(x => {
    const [key, value] = x.split("=")

    return { key, value }
  })

  const o = {}

  for (const x of chunks) {
    const { key, value } = x

    switch (key) {
    case "FREQ":
      if (![
        "SECONDLY", "MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"
      ].includes(value)) {
        throw new Error("Provided FREQ is invalid")
      }
      o.frequency = value.toLowerCase()
      break
    case "UNTIL":
      if (o.count) {
        throw new Error("UNTIL and COUNT must not co-occur in a recurring rule")
      }
      o.until = isoString(value)
      break
    case "COUNT":
      if (o.until) {
        throw new Error("UNTIL and COUNT must not co-occur in a recurring rule")
      }
      o.count = parseInt(value, 10)
      break
    case "INTERVAL":
      o.interval = parseInt(value, 10)
      break
    case "BYSECOND":
      o.bySecond = value.split(",").map(x => parseInt(x, 10))
      break
    case "BYMINUTE":
      o.byMinute = value.split(",").map(x => parseInt(x, 10))
      break
    case "BYHOUR":
      o.byHour = value.split(",").map(x => parseInt(x, 10))
      break
    case "BYDAY":
      // TODO: handle 1FR, 2FR and FR
      o.byDay = value.split(",") //.map(x => parseInt(x, 10))
      break
    case "BYMONTHDAY":
      o.byMonthDay = value.split(",").map(x => parseInt(x, 10))
      break
    case "BYYEARDAY":
      o.byYearDay = value.split(",").map(x => parseInt(x, 10))
      break
    case "BYWEEKNO":
      o.byWeekNumber = value.split(",").map(x => parseInt(x, 10))
      break
    case "BYMONTH":
      o.byMonth = value.split(",").map(x => parseInt(x, 10))
      break
    case "BYSETPOS":
      o.bySetPosition = value.split(",").map(x => parseInt(x, 10))
      break
    case "WKST":
      o.weekStart = value
      break
    }
  }

  return o
}

const TIME_UNITS = {
  yearly: "years",
  monthly: "months",
  weekly: "weeks",
  daily: "days",
  hourly: "hours",
  minutely: "minutes",
  secondly: "seconds"
}

function* allDates(fromDate, rule) {
  let curDate = fromDate.clone()
  const weekStart = rule.weekStart == null ? "MO" : rule.weekStart
  const interval = rule.interval == null ? 1 : rule.interval
  let watchdog = 0
  let i = 0

  if (rule.frequency === "weekly") {
    if (rule.byDay && !rule.byDay.includes(DAYS[curDate.day()])) {
      // According to the spec, the start date is _always_ generated, even if it doesnt fit.
      yield curDate.clone()

      if (rule.count) {
        ++i

        if (i >= rule.count) {
          return
        }
      }
    }
  }

  for (;;) {
    // Apply UNTIL rule
    if (rule.until && curDate.isAfter(rule.until)) {
      break
    }

    if (rule.frequency === "daily") {
      // Mutating function, beware!

      if (rule.byDay) {
        const days = rule.byDay && rule.byDay.map(d => DAYS.indexOf(d))

        if (days.includes(curDate.day())) {
          yield curDate.clone()

          if (rule.count) {
            ++i

            if (i >= rule.count) {
              return
            }
          }
        }

        dayDate.add(1, "days")

      } else {
        yield curDate.clone()

        if (rule.count) {
          ++i

          if (i >= rule.count) {
            return
          }
        }

        curDate.add(interval, "days")
      }
    } else if (rule.frequency === "weekly") {
      const weeklyDate = curDate.clone()

      if (rule.byDay) {
        const month = weeklyDate.month()
        const days = rule.byDay.map(d => DAYS.indexOf(d))
        const dayDate = weeklyDate.clone()

        for (;;) {
          if (days.includes(dayDate.day())) {
            yield dayDate.clone()

            if (rule.count) {
              ++i

              if (i >= rule.count) {
                return
              }
            }
          }

          dayDate.add(1, "days")

          if (dayDate.day() === DAYS.indexOf(weekStart)) {
            break
          }
        }

        for (let i = 1; i < interval; ++i) {
          dayDate.add(1, "weeks")
        }

        curDate = dayDate.clone()
      } else {
        yield weeklyDate.clone()

        if (rule.count) {
          ++i

          if (i >= rule.count) {
            return
          }
        }

        curDate.add(interval, "weeks")
      }
    } else if (rule.frequency === "yearly") {
      if (rule.byMonth) {
        const monthDate = curDate.clone()

        for (const month of rule.byMonth) {
          monthDate.set("month", month - 1)

          while (monthDate.month() === month - 1) {
            const days = rule.byDay && rule.byDay.map(d => DAYS.indexOf(d))

            if (days) {
              if (!days.includes(monthDate.day())) {
                monthDate.add(1, "days")
                continue
              }
            }

            yield monthDate.clone()

            if (rule.count) {
              ++i

              if (i >= rule.count) {
                return
              }
            }

            monthDate.add(1, "days")
          }
        }
      } else if (rule.byDay) {

      }

      curDate.add(interval, "years")
    } else {
      throw new Error("Invalid frequency: " + rule.frequency)
    }

  }
}

module.exports = {
  parseRule,
  allDates
}
