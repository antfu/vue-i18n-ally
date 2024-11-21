export enum ExtractionScore {
  MustInclude,
  ShouldInclude,
  None,
  ShouldExclude,
  MustExclude
}

export abstract class ExtractionRule {
  abstract name: string

  shouldExtract(str: string): ExtractionScore | void {
    return ExtractionScore.None
  }
}
