export interface CustomTimelineEvent {
	id: string;
	title: string;
	date: number;
	action: "activity";
	tags: string[];
	category: null;
	available: true;
}

interface TimelineData {
	events: CustomTimelineEvent[];
	hiddenEventIds: string[];
}

let timelineRequest: Promise<TimelineData> | null = null;

export function getTimelineData() {
	if (!timelineRequest) {
		timelineRequest = fetch("/api/timeline", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok) {
					throw new Error(result.error || "Failed to load the public timeline.");
				}
				return {
					events: (result.events || []) as CustomTimelineEvent[],
					hiddenEventIds: (result.hiddenEventIds || []) as string[],
				};
			})
			.catch((error) => {
				timelineRequest = null;
				throw error;
			});
	}
	return timelineRequest;
}

export function invalidateTimelineData() {
	timelineRequest = null;
}
