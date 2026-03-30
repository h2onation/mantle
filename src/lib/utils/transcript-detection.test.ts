import { describe, it, expect } from "vitest";
import { detectTranscript } from "@/lib/utils/transcript-detection";

describe("detectTranscript", () => {
  describe("returns no transcript for normal messages", () => {
    it("short message", () => {
      const result = detectTranscript("I've been thinking about my mom lately");
      expect(result.isTranscript).toBe(false);
    });

    it("long emotional message without transcript structure", () => {
      const msg =
        "I had this massive fight with my partner last night and I just can't stop thinking about it. " +
        "He came home late and I didn't say anything at first because I was trying to be cool about it " +
        "but then he made this comment about dinner being cold and something just snapped in me. " +
        "I started yelling about how he never respects my time and he got really quiet which made me " +
        "even more angry because that's what he always does. He just shuts down and I'm left there " +
        "feeling like I'm the crazy one. I know I overreacted but I also know that feeling didn't come " +
        "from nowhere. It's been building for weeks. Every time he's late it feels like he's saying my " +
        "time doesn't matter and I just absorbed it until I couldn't anymore.";
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(false);
    });

    it("message with a single inline quote", () => {
      const msg =
        'He said "I can\'t do this anymore" and I just froze. I didn\'t know what to say. ' +
        "She was like \"that's not fair\" and then nobody talked for the rest of dinner. " +
        "I keep replaying it in my head and I can't figure out what I should have said.";
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(false);
    });
  });

  describe("detects speaker-alternating transcripts", () => {
    it("iMessage style", () => {
      const msg = `Him: hey are you okay? you've been quiet
Me: yeah I'm fine just tired
Him: okay... you sure?
Me: yes I'm sure lol
Him: alright. love you
Me: love you too`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
      expect(result.format).toBe("speaker_alternating");
    });

    it("named speakers", () => {
      const msg = `Sarah: Did you talk to him yet?
Me: No I keep putting it off
Sarah: You need to just do it
Me: I know but every time I try I freeze up
Sarah: What are you afraid will happen?
Me: That he'll leave
Sarah: Has he ever said he would?
Me: No but the feeling is there`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
      expect(result.format).toBe("speaker_alternating");
    });
  });

  describe("detects email threads", () => {
    it("standard email headers", () => {
      const msg = `From: John Smith
To: Jane Doe
Subject: Re: Meeting tomorrow

Jane,

I think we should postpone. The team isn't ready.

> On March 15, John wrote:
> Let's meet tomorrow to discuss the proposal.
> I have some concerns about the timeline.

From: Jane Doe
To: John Smith
Subject: Re: Meeting tomorrow

That's fine. When works for you next week?`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
      expect(result.format).toBe("email_thread");
    });

    it("forwarded email chain", () => {
      const msg = `---------- Forwarded message ---------
From: Boss <boss@company.com>
Date: Mon, Mar 15
Subject: Performance Review

I'd like to discuss your Q1 numbers.

> On Mar 14, I wrote:
> Just wanted to check in about the review timeline.
> Happy to meet whenever works.
>
> Thanks`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
    });
  });

  describe("detects timestamped chat", () => {
    it("bracket timestamps", () => {
      const msg = `[10:32] Mom: Are you coming to dinner Sunday?
[10:33] Me: I think so
[10:33] Mom: Your sister will be there
[10:35] Me: Ok
[10:35] Mom: She's been asking about you
[10:40] Me: I'll be there
[10:41] Mom: Wonderful. 6pm.`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
    });

    it("AM/PM timestamps", () => {
      const msg = `2:15 PM - Alex: hey can we talk
2:16 PM - Me: sure what's up
2:16 PM - Alex: I heard about the promotion
2:17 PM - Me: yeah
2:17 PM - Alex: are you okay?
2:18 PM - Me: honestly not really`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
    });
  });

  describe("detects journal entries", () => {
    it("journal with date header and paragraphs", () => {
      const msg = `March 15, 2024

I woke up this morning feeling off. Not sad exactly but like something was sitting on my chest. I couldn't name it at first but then I realized it was dread. The meeting is tomorrow and I've been avoiding thinking about it for days.

I keep telling myself it's not a big deal. It's just a conversation. But my body knows better. My shoulders are up by my ears and I can feel that tightness in my jaw that shows up when I'm bracing for something.

The last time I felt this way was before the conversation with my dad. Same feeling. Same avoidance. Same telling myself it would be fine while my body was already preparing for impact. I wonder if this is a pattern. The dread isn't about what's going to happen. It's about not being able to control what's going to happen.`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
      expect(result.format).toBe("journal");
    });

    it("does not flag long text without date header as journal", () => {
      const msg =
        "I woke up this morning feeling off. Not sad exactly but like something was sitting on my chest. " +
        "I couldn't name it at first but then I realized it was dread. The meeting is tomorrow.\n\n" +
        "I keep telling myself it's not a big deal. It's just a conversation. But my body knows better.\n\n" +
        "The last time I felt this way was before the conversation with my dad. Same feeling. Same avoidance.";
      const result = detectTranscript(msg);
      // No date header, so journal detector shouldn't fire
      expect(result.format).not.toBe("journal");
    });
  });

  describe("context alongside transcript", () => {
    it("detects transcript even with context paragraph before it", () => {
      const msg = `Here's what happened with my mom yesterday. I don't know what to do about this.

Mom: I noticed you haven't called in a while
Me: I've been busy with work
Mom: You always say that
Me: Because it's always true
Mom: Your brother calls every week
Me: I'm not David
Mom: I just miss hearing from you
Me: I know. I'm sorry.`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns no transcript for empty string", () => {
      const result = detectTranscript("");
      expect(result.isTranscript).toBe(false);
    });

    it("returns no transcript for very short message", () => {
      const result = detectTranscript("hey");
      expect(result.isTranscript).toBe(false);
    });

    it("high confidence when multiple signals match", () => {
      // Speaker alternating + many short lines
      const msg = `[10:00] John: hey
[10:01] Me: hi
[10:01] John: can we talk
[10:02] Me: sure
[10:02] John: about last night
[10:03] Me: what about it
[10:03] John: you seemed upset
[10:04] Me: I was fine
[10:04] John: you left early
[10:05] Me: I was tired`;
      const result = detectTranscript(msg);
      expect(result.isTranscript).toBe(true);
      expect(result.confidence).toBe("high");
    });
  });
});
