// Display-only summaries of the recorded trace; complete wording stays in traces.js.
// `observation` summarizes the following step's observation of this call's result.
window.OMNI_DEMO_COPY = {
  istanbul: {
    1: { title: "Inspect a possible match", think: "Look closely at the distant trolley to check for gas canisters.", observation: "A person pushes an orange trolley along the cobblestone street." },
    2: { title: "Listen to the candidate", think: "Check whether the trolley makes the expected rattling sound.", observation: "Metallic clanking is audible as the distant trolley moves along the street." },
    3: { title: "Identify the cart", think: "Use high-resolution frames to identify what the trolley carries.", observation: "The close-up shows a glass-cased food cart, not gas canisters." },
    13: { title: "Search four more spans", think: "The earlier candidate was wrong. Compare four unexamined parts of the video.", observation: "The third span reveals a man pushing a hand truck loaded with gas canisters." },
    14: { title: "Verify sight and sound", think: "Inspect the new candidate with audio to confirm the canisters and rattling.", observation: "Three canisters pass the camera on a hand truck, with metallic rattling on the cobblestones." },
    16: { title: "Refine the time boundaries", think: "After a rejected request, use a five-second high-resolution window to check the start and end.", observation: "The frames establish when the man starts passing the camera and moves out of view." }
  },
  porsche: {
    1: { title: "Compare the spoken and visible counts", think: "Listen for the narrator’s count and inspect the Porsche 918s in the lineup.", observation: "The narrator says “three 918 Spyders”; the clip shows the parked lineup." },
    2: { title: "Recheck the student’s count", draft: "The student reports three 918s in the audio and three visible cars.", correction: "Recount the lineup in high-resolution frames before answering.", observation: "The black 918 is clear in the closer view. The visual count still needs a wider shot." },
    3: { title: "Confirm the spoken count", think: "Listen again to verify exactly how many 918s the narrator names.", observation: "The audio confirms the phrase “three 918 Spyders”." },
    4: { title: "Find the wide view", think: "Look for a view that covers the full lineup so the visible cars can be counted.", observation: "The opening sequence contains a wide shot of the cars in the plaza." },
    5: { title: "Count the visible cars", think: "Inspect the wide shot at high resolution to settle the visual count.", observation: "Two 918s are visible: one black and one white with Martini livery." }
  },
  launch: {
    1: { title: "Find the sound", think: "Locate a loud rev followed by a tire screech, then check the matching action.", observation: "The opening audio contains both sounds." },
    2: { title: "Check what is on screen", think: "Inspect the opening clip to see what the car is doing during those sounds.", observation: "The sounds play over title cards; the car’s action is not visible here." },
    4: { title: "Search the driving footage", think: "The previous call exceeded the audio limit. Retry with four shorter candidate spans.", observation: "The first span contains the rev and tire screech around 02:45–02:48." },
    5: { title: "Match sound to action", think: "Watch the clip around the matching sound to identify the car’s movement.", observation: "The blue car leaves the turnout as the engine revs and the tires briefly screech." }
  }
};
