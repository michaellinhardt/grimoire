# Jira Timeline View Research Report

This document summarizes research on how Jira Timeline (Roadmap) view displays epics and tasks on a horizontal timeline, with insights applicable to our implementation.

## Executive Summary

Jira Timeline uses a Gantt-style visualization where:
- **Bars represent work items** with horizontal position and length determined by start/end dates
- **Time axis provides three zoom levels**: Weeks, Months, Quarters
- **Grid columns have fixed widths** at each zoom level
- **Bar positions scale proportionally** to maintain temporal accuracy across zoom levels

---

## 1. Time Axis Behavior

### Available Time Scales

Jira provides three discrete zoom levels accessible via a toggle in the bottom-right corner:

| Scale | Column Unit | Default Duration (no dates) |
|-------|-------------|----------------------------|
| Weeks | 1 week | 7 days |
| Months | 1 month | 14 days |
| Quarters | 1 quarter | 30 days |

**Source**: [Atlassian Support - Timeline View](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-timeline-and-how-do-i-use-it/)

### Column Width Behavior

Based on Jira's implementation and standard Gantt chart patterns:

- **Column widths are fixed per zoom level** - Each time unit (week/month/quarter) occupies a consistent pixel width
- **Switching zoom levels changes the visible time range** - More granular views (Weeks) show less total time but more detail
- **Horizontal scrolling** enables navigation when the timeline exceeds the viewport

Jira does not expose column width configuration to end users. The system automatically determines widths based on the selected time scale.

### Navigation Features

- **"Today" marker**: An orange vertical line indicates the current date
- **"Today" button**: Quick navigation to return to the current date position
- **Horizontal scrolling**: Navigate through past and future time periods

---

## 2. Bar Positioning and Sizing

### How Bars Are Positioned

From Atlassian's documentation:

> "Schedule bars on the timeline represent the start date and due date of each work item."

**Key positioning rules**:

1. **Start position**: Determined by the item's start date field
2. **End position**: Determined by the item's due date/end date field
3. **Bar length**: Spans from start date to end date, proportional to actual duration
4. **Vertical position**: Determined by the row/issue hierarchy

### Date Field Sources

Jira uses these fields for positioning:

| Field | Purpose |
|-------|---------|
| Start Date | Left edge of the bar |
| Due Date | Right edge of the bar |
| Sprint dates | Can infer positioning if no explicit dates |
| Child dates | Parent bars can "roll up" dates from children |

**Date Roll-up**: When parent items (epics) don't have explicit dates, Jira can infer them from child items. These inferred dates are indicated by:
- Striped "candy-cane" pattern on the bar
- Arrow indicators on the rolled-up fields
- Faded bar ends for partial roll-ups

### Interaction Capabilities

- **Drag bar ends**: Adjust start or end dates
- **Drag entire bar**: Move both dates while maintaining duration
- **Click to edit**: Open detail panel for precise date entry

---

## 3. Zoom Behavior

### What Changes When Zooming

| Aspect | Weeks View | Months View | Quarters View |
|--------|------------|-------------|---------------|
| Column represents | 1 week | 1 month | 1 quarter |
| Visible time range | Shorter | Medium | Longer |
| Detail level | Highest | Medium | Lowest |
| Bar precision | Most precise | Less precise | Least precise |

### What Does NOT Change

- **Relative bar positions**: A task starting on Jan 15 will always appear at the same relative position within January, regardless of zoom level
- **Temporal relationships**: Dependencies and overlaps remain visually accurate
- **Bar proportions**: A 2-week task will always appear twice as long as a 1-week task

### Implementation Pattern (from Gantt Chart Libraries)

Based on research into Gantt implementations like DHTMLX and Syncfusion:

```
Bar Position (x) = (startDate - viewportStartDate) * pixelsPerTimeUnit
Bar Width = (endDate - startDate) * pixelsPerTimeUnit
```

Where `pixelsPerTimeUnit` changes based on zoom level:
- **Weeks view**: More pixels per day (zoomed in)
- **Quarters view**: Fewer pixels per day (zoomed out)

---

## 4. Empty Time Periods

### How Jira Handles Gaps

- **Continuous timeline**: The time axis displays continuously, even when no work items exist in a period
- **No collapse behavior**: Empty weeks/months are not hidden or collapsed
- **Visual consistency**: Grid columns maintain uniform width regardless of content

### Filtering Effects

Items may not appear on the timeline due to:
- Missing start/end dates
- Completed items over 1 year old (auto-excluded)
- Items outside the selected time scope
- Work item limits exceeded (5,000 total, 500 parents max)

---

## 5. Key Insights for Our Implementation

Based on the research findings and the stated requirements:

### Requirement Mapping

| Jira Behavior | Our Requirement | Implementation Approach |
|---------------|-----------------|------------------------|
| Fixed column width per zoom level | Block size input controls time granularity | Column pixel width is constant; block size changes what time each column represents |
| Proportional bar positioning | Bars span from start to end time | Calculate bar position as: `(startTime - viewportStart) / blockSize * columnWidth` |
| Zoom preserves temporal relationships | Changing block size doesn't change bar positions relative to time | Recalculate grid divisions without moving bars in absolute time |

### Critical Design Principles

1. **Column Width is Fixed**
   - Each grid column should have a constant pixel width (e.g., 80px, 100px)
   - This is a display constant, not tied to time duration

2. **Block Size Controls Time Granularity**
   - Block size determines how much time each column represents
   - Example: `blockSize = 60` means each column = 1 hour
   - Example: `blockSize = 1440` means each column = 1 day (1440 minutes)

3. **Bar Position Formula**
   ```
   barLeft = ((itemStartTime - timelineStartTime) / blockSize) * columnWidthPx
   barWidth = ((itemEndTime - itemStartTime) / blockSize) * columnWidthPx
   ```

4. **Changing Block Size**
   - Increasing block size: Grid columns represent more time, bars appear narrower
   - Decreasing block size: Grid columns represent less time, bars appear wider
   - **Key**: Bar positions relative to TIME remain unchanged; only the visual scale changes

### Visual Indicators (from Jira)

Consider implementing:
- **Today marker**: Vertical line at current time
- **Duration indicators**: Show start/end times on hover
- **Dependency arrows**: Connect related items
- **Status colors**: Visual differentiation by item status

### Scroll Behavior

- **Horizontal scroll**: For timeline navigation
- **Viewport anchoring**: When zooming, keep the center of viewport at same time position
- **Time range limits**: Define min/max displayable range

---

## 6. Technical Reference: Gantt Chart Libraries

For implementation reference, these patterns are used by major Gantt libraries:

### DHTMLX Gantt

```javascript
gantt.config.scales = [
  { unit: "month", step: 1, format: "%F %Y" },
  { unit: "day", step: 1, format: "%d", column_width: 60 }
];
```

- `column_width`: Fixed pixel width for bottom-most scale
- Tasks positioned using: `gantt.date.<unit>_start()` and `gantt.date.add_<unit>()`

**Source**: [DHTMLX Gantt Scale Configuration](https://docs.dhtmlx.com/gantt/guides/configuring-time-scale/)

### Syncfusion React Gantt

- `timelineUnitSize`: Controls cell width (e.g., 150px for month mode, 70px for year mode)
- Two-tier timeline: Top tier (larger units) + Bottom tier (smaller units)
- View modes: Hour, Day, Week, Month, Quarter, Year

**Source**: [Syncfusion React Gantt Timeline](https://ej2.syncfusion.com/react/documentation/gantt/time-line/time-line)

---

## Sources

- [Atlassian - Plan Ahead: Master Timelines in Jira](https://www.atlassian.com/software/jira/guides/basic-roadmaps/overview)
- [Atlassian Support - What is the timeline view?](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-timeline-and-how-do-i-use-it/)
- [Atlassian Support - Customize roadmap view settings](https://support.atlassian.com/jira-software-cloud/docs/customize-your-roadmaps-view-settings/)
- [Atlassian - Using the Timeline (Advanced Roadmaps)](https://confluence.atlassian.com/advancedroadmapsserver/using-the-timeline-802170554.html)
- [Atlassian Support - How your plan shows work items](https://support.atlassian.com/jira-software-cloud/docs/how-do-i-read-my-advanced-roadmaps-plan/)
- [Atlassian Community - How to Use Jira Timeline View](https://community.atlassian.com/forums/App-Central-articles/How-to-Use-Jira-Timeline-View-Everything-You-Need-to-Know/ba-p/2826791)
- [DHTMLX Gantt - Configuring Time Scale](https://docs.dhtmlx.com/gantt/guides/configuring-time-scale/)
- [Syncfusion React Gantt Chart](https://www.syncfusion.com/react-components/react-gantt-chart)
- [gantt-task-react GitHub](https://github.com/MaTeMaTuK/gantt-task-react)
